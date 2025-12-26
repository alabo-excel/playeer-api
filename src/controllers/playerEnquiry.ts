import { Request, Response } from 'express';
import PlayerEnquiry from '../models/PlayerEnquiry';
import User from '../models/User';

const validInquiryTypes = ['player_signing', 'negotiations', 'more_information', 'expression_of_interest', 'others', ''];
const validDesignations = ['agent', 'scout', 'club', 'academy', 'coach', 'broker', 'others', ''];

export const createEnquiry = async (req: Request, res: Response) => {
    try {
        const payload = req.body as any;

        // Basic validation
        if (!payload) {
            return res.status(400).json({ success: false, message: 'Payload is required' });
        }

        const { name, email, phone, inquiryType, designation, message, playerId } = payload;

        if (!name || typeof name !== 'string') {
            return res.status(400).json({ success: false, message: 'Valid name is required' });
        }

        if (!email || typeof email !== 'string') {
            return res.status(400).json({ success: false, message: 'Valid email is required' });
        }

        if (!playerId || typeof playerId !== 'string') {
            return res.status(400).json({ success: false, message: 'playerId is required' });
        }

        if (inquiryType && !validInquiryTypes.includes(inquiryType)) {
            return res.status(400).json({ success: false, message: 'Invalid inquiryType' });
        }

        if (designation && !validDesignations.includes(designation)) {
            return res.status(400).json({ success: false, message: 'Invalid designation' });
        }

        // Save enquiry
        const enquiry = new PlayerEnquiry({ name, email, phone, inquiryType, designation, message, playerId });
        const saved = await enquiry.save();

        res.status(201).json({ success: true, message: 'Enquiry created', data: saved });
    } catch (error) {
        console.error('Error creating player enquiry:', error);
        res.status(500).json({ success: false, message: 'Internal server error', error: error instanceof Error ? error.message : error });
    }
};

// GET /player-enquiries
export const getEnquiries = async (req: Request, res: Response) => {
    try {
        const { page = 1, limit = 20, search = '', playerId, email } = req.query as any;

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
        const skip = (pageNum - 1) * limitNum;

        const query: any = {};

        if (playerId) query.playerId = playerId;
        if (email) query.email = String(email).toLowerCase();

        if (search && typeof search === 'string' && search.trim() !== '') {
            const regex = new RegExp(search.trim(), 'i');
            query.$or = [
                { name: { $regex: regex } },
                { email: { $regex: regex } },
                { phone: { $regex: regex } },
                { message: { $regex: regex } }
            ];
        }

        const [items, total] = await Promise.all([
            PlayerEnquiry.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
            PlayerEnquiry.countDocuments(query)
        ]);

        // Bulk-resolve playerIds to user fullName to avoid N+1 queries
        const playerIdSet = new Set<string>();
        items.forEach((it: any) => { if (it.playerId) playerIdSet.add(String(it.playerId)); });

        let playerMap: Record<string, any> = {};
        if (playerIdSet.size > 0) {
            const playerIds = Array.from(playerIdSet);

            // Try to find users by _id for those that look like ObjectIds
            const byIdCandidates = playerIds.filter(id => /^[a-fA-F0-9]{24}$/.test(id));
            const byEmailCandidates = playerIds.filter(id => id.includes('@'));
            const byUsernameCandidates = playerIds.filter(id => !id.includes('@') && !/^[a-fA-F0-9]{24}$/.test(id));

            const queries: any[] = [];
            if (byIdCandidates.length) queries.push({ _id: { $in: byIdCandidates.map(id => id) } });
            if (byEmailCandidates.length) queries.push({ email: { $in: byEmailCandidates.map(e => e.toLowerCase()) } });
            if (byUsernameCandidates.length) queries.push({ username: { $in: byUsernameCandidates } });

            if (queries.length) {
                const users = await User.find({ $or: queries }).select('fullName email username').lean();
                users.forEach((u: any) => {
                    if (u._id) playerMap[String(u._id)] = u;
                    if (u.email) playerMap[String(u.email).toLowerCase()] = u;
                    if (u.username) playerMap[String(u.username)] = u;
                });
            }
        }

        // Attach player summary to each item
        const itemsWithPlayer = items.map((it: any) => {
            const keyCandidates = [String(it.playerId), String(it.playerId).toLowerCase()];
            const player = keyCandidates.map(k => playerMap[k]).find(Boolean) || null;
            return {
                ...it,
                player: player ? { id: player._id, fullName: player.fullName } : null
            };
        });

        const totalPages = Math.ceil(total / limitNum);

        res.status(200).json({
            success: true,
            message: 'Player enquiries retrieved',
            data: {
                items: itemsWithPlayer,
                pagination: {
                    total,
                    totalPages,
                    page: pageNum,
                    limit: limitNum
                }
            }
        });
    } catch (error) {
        console.error('Error fetching enquiries:', error);
        res.status(500).json({ success: false, message: 'Internal server error', error: error instanceof Error ? error.message : error });
    }
};

// GET /player-enquiries/:id
export const getEnquiry = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({ success: false, message: 'Enquiry id is required' });
        }

        const enquiry = await PlayerEnquiry.findById(id).lean();
        if (!enquiry) {
            return res.status(404).json({ success: false, message: 'Enquiry not found' });
        }

        // Try to populate full player object from User model if possible (exclude password)
        let player: any = null;
        try {
            if (enquiry.playerId) {
                // 1) Try by _id
                player = await User.findById(enquiry.playerId).select('-password').lean();

                // 2) If not found and looks like an email, try find by email
                if (!player && typeof enquiry.playerId === 'string' && enquiry.playerId.includes('@')) {
                    player = await User.findOne({ email: enquiry.playerId.toLowerCase() }).select('-password').lean();
                }

                // 3) If still not found, try as username
                if (!player && typeof enquiry.playerId === 'string') {
                    player = await User.findOne({ username: enquiry.playerId }).select('-password').lean();
                }
            }
        } catch (e) {
            console.warn('Error populating player for enquiry:', e);
            player = null;
        }

        const result = {
            ...enquiry,
            player: player || null
        };

        res.status(200).json({ success: true, message: 'Enquiry retrieved', data: result });
    } catch (error) {
        console.error('Error fetching single enquiry:', error);
        res.status(500).json({ success: false, message: 'Internal server error', error: error instanceof Error ? error.message : error });
    }
};


