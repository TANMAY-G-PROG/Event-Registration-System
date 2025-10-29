require('dotenv').config();
const express = require('express');
const path = require('path');
const supabase = require('./lib/supabase');
const session = require('express-session');
const bcrypt = require('bcrypt');
const cors = require('cors');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;


app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['set-cookie']
}));


app.use(express.json());


app.use(session({
    secret: 'your-event-management-secret-key-change-this-in-production',
    resave: false,
    saveUninitialized: false,
    name: 'sessionId', // Custom cookie name
    cookie: {
        secure: false, // Set to true if using HTTPS
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: 'lax', // IMPORTANT for cross-origin
        path: '/'
    }
}));

// STEP 4: Debug middleware to log all requests
app.use((req, res, next) => {
    console.log(`\n🔍 ${req.method} ${req.url}`);
    console.log('📋 Session ID:', req.sessionID);
    console.log('👤 User USN:', req.session.userUSN || 'Not logged in');
    console.log('🍪 Cookies:', req.headers.cookie || 'No cookies');
    next();
});

// Test Supabase connection
async function testSupabaseConnection() {
    try {
        const { data, error } = await supabase.from('student').select('count').limit(1);
        if (error) throw error;
        console.log('✅ Supabase connected successfully');
    } catch (err) {
        console.error('❌ Supabase connection failed:', err);
    }
}
testSupabaseConnection();

// ADDED: Configure Gmail transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
    }
});

// ADDED: Verify email configuration on startup
transporter.verify((error, success) => {
    if (error) {
        console.error('❌ Email configuration error:', error);
    } else {
        console.log('✅ Email server is ready');
    }
});

// Middleware to check if user is authenticated
function requireAuth(req, res, next) {
    console.log('🔒 Auth check - Session USN:', req.session.userUSN);
    if (req.session.userUSN) {
        console.log('✅ User authenticated:', req.session.userUSN);
        next();
    } else {
        console.log('❌ User NOT authenticated - sending 401');
        res.status(401).json({ error: 'Please sign in first' });
    }
}

// Sign up endpoint
app.post('/api/signup', async (req, res) => {
    try {
        const { name, usn, sem, mobno, email, password } = req.body;
        
        if (!usn || !name || !email || !sem || !mobno || !password) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        if (!/^1BM\d{2}[A-Z]{2}\d{3}$/.test(usn)) {
            return res.status(400).json({ error: 'Invalid USN format' });
        }

        const { data: existingUser, error: checkError } = await supabase
            .from('student')
            .select('usn')
            .or(`usn.eq.${usn},emailid.eq.${email}`)
            .limit(1);
        
        if (checkError) {
            console.error('Error checking existing user:', checkError);
            return res.status(500).json({ error: 'Database error' });
        }
        
        if (existingUser && existingUser.length > 0) {
            return res.status(400).json({ error: 'Student with this USN or email already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        
        const { data, error } = await supabase
            .from('student')
            .insert([{
                usn: usn,
                sname: name,
                sem: sem,
                mobno: mobno,
                emailid: email,
                password: hashedPassword
            }])
            .select();
        
        if (error) {
            console.error('Error inserting student:', error);
            return res.status(500).json({ error: `Error registering student: ${error.message}` });
        }
        
        // Create session
        req.session.userUSN = usn;
        req.session.userName = name;
        req.session.userEmail = email;
        
        // Save session explicitly
        req.session.save((err) => {
            if (err) {
                console.error('❌ Session save error:', err);
                return res.status(500).json({ error: 'Session error' });
            }
            console.log('✅ Session created for:', usn);
            console.log('🆔 Session ID:', req.sessionID);
            
            res.status(201).json({ 
                success: true,
                message: 'Student registered successfully!', 
                userUSN: usn,
                userName: name
            });
        });
    } catch (err) {
        console.error('Error registering student:', err);
        res.status(500).json({ error: `Error registering student: ${err.message}` });
    }
});

// Sign in endpoint
app.post('/api/signin', async (req, res) => {
    try {
        const { usn, password } = req.body;
        
        if (!usn || !password) {
            return res.status(400).json({ error: 'USN and password are required' });
        }
        
        const { data: rows, error } = await supabase
            .from('student')
            .select('usn, sname, emailid, password')
            .eq('usn', usn)
            .limit(1);
        
        if (error) {
            console.error('Error fetching student:', error);
            return res.status(500).json({ error: 'Database error' });
        }
        
        if (!rows || rows.length === 0) {
            return res.status(401).json({ error: 'Invalid USN or password' });
        }
        
        const student = rows[0];
        
        const validPassword = await bcrypt.compare(password, student.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid USN or password' });
        }
        
        // Create session
        req.session.userUSN = student.usn;
        req.session.userName = student.sname;
        req.session.userEmail = student.emailid;
        
        // Save session explicitly
        req.session.save((err) => {
            if (err) {
                console.error('❌ Session save error:', err);
                return res.status(500).json({ error: 'Session error' });
            }
            console.log('✅ User signed in:', student.usn);
            console.log('🆔 Session ID:', req.sessionID);
            
            res.json({ 
                success: true, 
                message: 'Signed in successfully',
                userUSN: student.usn,
                userName: student.sname
            });
        });
    } catch (err) {
        console.error('Error signing in:', err);
        res.status(500).json({ error: `Error signing in: ${err.message}` });
    }
});

// Get current user info
app.get('/api/me', requireAuth, async (req, res) => {
    try {
        const { data: rows, error } = await supabase
            .from('student')
            .select('usn, sname, sem, mobno, emailid')
            .eq('usn', req.session.userUSN)
            .limit(1);
        
        if (error) {
            console.error('Error fetching user info:', error);
            return res.status(500).json({ error: 'Database error' });
        }
        
        if (!rows || rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const student = rows[0];
        res.json({
            userUSN: student.usn,
            userName: student.sname,
            semester: student.sem,
            mobile: student.mobno,
            email: student.emailid
        });
    } catch (err) {
        console.error('Error fetching user info:', err);
        res.status(500).json({ error: 'Error fetching user info' });
    }
});

// Sign out endpoint
app.post('/api/signout', (req, res) => {
    const userUSN = req.session.userUSN;
    req.session.destroy((err) => {
        if (err) {
            console.error('❌ Session destroy error:', err);
            return res.status(500).json({ error: 'Could not sign out' });
        }
        console.log('✅ User signed out:', userUSN);
        res.json({ success: true, message: 'Signed out successfully' });
    });
});

// Get all events
app.get('/api/events', requireAuth, async (req, res) => {
    try {
        const currentDate = new Date().toISOString().split('T')[0];
        
        const { data: rows, error } = await supabase
            .from('event')
            .select(`
                eid, ename, eventdesc, eventdate, eventtime, eventloc, maxpart, maxvoln, regfee,
                club:orgcid(cname),
                student:orgusn(sname)
            `);
        
        if (error) {
            console.error('Error fetching events:', error);
            return res.status(500).json({ error: 'Database error' });
        }

        const events = {
            ongoing: [],
            completed: [],
            upcoming: []
        };

        (rows || []).forEach(event => {
            const transformedEvent = {
                ...event,
                eventDate: event.eventdate,
                eventTime: event.eventtime,
                eventLoc: event.eventloc,
                maxPart: event.maxpart,
                maxVoln: event.maxvoln,
                regFee: event.regfee,
                clubName: event.club?.cname,
                organizerName: event.student?.sname
            };
            
            const eventDate = new Date(event.eventdate).toISOString().split('T')[0];
            if (eventDate === currentDate) events.ongoing.push(transformedEvent);
            else if (eventDate < currentDate) events.completed.push(transformedEvent);
            else events.upcoming.push(transformedEvent);
        });

        res.json({
            events,
            currentUser: req.session.userUSN
        });
    } catch (err) {
        console.error('Error fetching events:', err);
        res.status(500).json({ error: 'Error fetching events: ' + err.message });
    }
});

// Get user's participant events only
app.get('/api/my-participant-events', requireAuth, async (req, res) => {
    try {
        const { data: participantEvents, error } = await supabase
            .from('participant')
            .select(`
                partstatus, partusn,
                event:parteid (
                    eid, ename, eventdesc, eventdate, eventtime, eventloc, maxpart, maxvoln, regfee,
                    club:orgcid(cname)
                )
            `)
            .eq('partusn', req.session.userUSN);
        
        if (error) {
            console.error('Error fetching participant events:', error);
            return res.status(500).json({ error: 'Database error' });
        }
        
        const transformedEvents = (participantEvents || []).map(p => ({
            ...p.event,
            eventDate: p.event?.eventdate,
            eventTime: p.event?.eventtime,
            eventLoc: p.event?.eventloc,
            maxPart: p.event?.maxpart,
            maxVoln: p.event?.maxvoln,
            regFee: p.event?.regfee,
            clubName: p.event?.club?.cname,
            PartStatus: p.partstatus,
            PartUSN: p.partusn,
            role: 'participant'
        })).filter(e => e.eid);
        
        res.json({
            participantEvents: transformedEvents,
            userUSN: req.session.userUSN
        });
    } catch (err) {
        console.error('Error fetching participant events:', err);
        res.status(500).json({ error: 'Error fetching participant events' });
    }
});

// Get user's volunteer events only
app.get('/api/my-volunteer-events', requireAuth, async (req, res) => {
    try {
        const { data: volunteerEvents, error } = await supabase
            .from('volunteer')
            .select(`
                volnstatus,
                event:volneid (
                    eid, ename, eventdesc, eventdate, eventtime, eventloc, maxpart, maxvoln, regfee,
                    club:orgcid(cname)
                )
            `)
            .eq('volnusn', req.session.userUSN);
        
        if (error) {
            console.error('Error fetching volunteer events:', error);
            return res.status(500).json({ error: 'Database error' });
        }
        
        const transformedEvents = (volunteerEvents || []).map(v => ({
            ...v.event,
            eventDate: v.event?.eventdate,
            eventTime: v.event?.eventtime,
            eventLoc: v.event?.eventloc,
            maxPart: v.event?.maxpart,
            maxVoln: v.event?.maxvoln,
            regFee: v.event?.regfee,
            clubName: v.event?.club?.cname,
            VolnStatus: v.volnstatus,
            role: 'volunteer'
        })).filter(e => e.eid);
        
        res.json({
            volunteerEvents: transformedEvents,
            userUSN: req.session.userUSN
        });
    } catch (err) {
        console.error('Error fetching volunteer events:', err);
        res.status(500).json({ error: 'Error fetching volunteer events' });
    }
});

// Get user's organized events only
app.get('/api/my-organized-events', requireAuth, async (req, res) => {
    try {
        const { data: organizerEvents, error } = await supabase
            .from('event')
            .select(`
                eid, ename, eventdesc, eventdate, eventtime, eventloc, maxpart, maxvoln, regfee,
                club:orgcid(cname)
            `)
            .eq('orgusn', req.session.userUSN);
        
        if (error) {
            console.error('Error fetching organized events:', error);
            return res.status(500).json({ error: 'Database error' });
        }
        
        const transformedEvents = (organizerEvents || []).map(e => ({
            ...e,
            eventDate: e.eventdate,
            eventTime: e.eventtime,
            eventLoc: e.eventloc,
            maxPart: e.maxpart,
            maxVoln: e.maxvoln,
            regFee: e.regfee,
            clubName: e.club?.cname,
            role: 'organizer'
        }));
        
        res.json({
            organizerEvents: transformedEvents,
            userUSN: req.session.userUSN
        });
    } catch (err) {
        console.error('Error fetching organized events:', err);
        res.status(500).json({ error: 'Error fetching organized events' });
    }
});

// Create/Organize a new event
app.post('/api/events/create', requireAuth, async (req, res) => {
    try {
        const { 
            eventName, 
            eventDescription, 
            eventDate, 
            eventTime, 
            eventLocation, 
            maxParticipants, 
            maxVolunteers, 
            registrationFee,
            clubId,
            OrgCid 
        } = req.body;
        
        const organizedClubId = clubId || OrgCid;
        
        if (!eventName || !eventDescription || !eventDate || !eventTime || !eventLocation) {
            return res.status(400).json({ error: 'Event name, description, date, time, and location are required' });
        }
        
        const eventDateObj = new Date(eventDate);
        const currentDate = new Date();
        if (eventDateObj <= currentDate) {
            return res.status(400).json({ error: 'Event date must be in the future' });
        }
        
        if (organizedClubId) {
            const { data: clubMembership, error: membershipError } = await supabase
                .from('memberof')
                .select('*')
                .eq('studentusn', req.session.userUSN)
                .eq('clubid', organizedClubId)
                .limit(1);
            
            if (membershipError) {
                console.error('Error checking club membership:', membershipError);
                return res.status(500).json({ error: 'Database error' });
            }
            
            if (!clubMembership || clubMembership.length === 0) {
                return res.status(403).json({ error: 'You must be a member of the club to organize events for it' });
            }
        }
        
        const { data, error } = await supabase
            .from('event')
            .insert([{
                ename: eventName,
                eventdesc: eventDescription,
                eventdate: eventDate,
                eventtime: eventTime,
                eventloc: eventLocation,
                maxpart: maxParticipants || null,
                maxvoln: maxVolunteers || null,
                regfee: registrationFee || 0,
                orgusn: req.session.userUSN,
                orgcid: organizedClubId || null
            }])
            .select('eid');
        
        if (error) {
            console.error('Error creating event:', error);
            return res.status(500).json({ error: `Error creating event: ${error.message}` });
        }
        
        res.status(201).json({ 
            success: true,
            message: 'Event created successfully!', 
            eventId: data[0]?.eid,
            organizerUSN: req.session.userUSN
        });
    } catch (err) {
        console.error('Error creating event:', err);
        res.status(500).json({ error: `Error creating event: ${err.message}` });
    }
});

// Join event as participant
app.post('/api/events/:eventId/join', requireAuth, async (req, res) => {
    try {
        const eventId = req.params.eventId;
        const userUSN = req.session.userUSN;
        
        const { data: existing, error: existingError } = await supabase
            .from('participant')
            .select('*')
            .eq('partusn', userUSN)
            .eq('parteid', eventId)
            .limit(1);
        
        if (existingError) {
            console.error('Error checking existing participation:', existingError);
            return res.status(500).json({ error: 'Database error' });
        }
        
        if (existing && existing.length > 0) {
            return res.status(400).json({ error: 'Already joined this event' });
        }
        
        const { data: event, error: eventError } = await supabase
            .from('event')
            .select('maxpart')
            .eq('eid', eventId)
            .limit(1);
        
        if (eventError) {
            console.error('Error fetching event:', eventError);
            return res.status(500).json({ error: 'Database error' });
        }
        
        if (!event || event.length === 0) {
            return res.status(404).json({ error: 'Event not found' });
        }

        const maxPart = event[0].maxpart || 0;
        if (maxPart > 0) {
            const { count, error: countError } = await supabase
                .from('participant')
                .select('*', { count: 'exact', head: true })
                .eq('parteid', eventId);

            if (countError) {
                console.error('Error counting participants:', countError);
                return res.status(500).json({ error: 'Database error' });
            }

            if (count >= maxPart) {
                return res.status(400).json({ error: 'No more participant slots available' });
            }
        }
        
        const { error: insertError } = await supabase
            .from('participant')
            .insert([{
                partusn: userUSN,
                parteid: eventId,
                partstatus: false
            }]);
        
        if (insertError) {
            console.error('Error joining event:', insertError);
            return res.status(500).json({ error: 'Database error' });
        }
        
        res.json({ success: true, message: 'Successfully joined event!' });
    } catch (err) {
        console.error('Error joining event:', err);
        res.status(500).json({ error: 'Error joining event' });
    }
});

// Volunteer for event
app.post('/api/events/:eventId/volunteer', requireAuth, async (req, res) => {
    try {
        const eventId = req.params.eventId;
        const userUSN = req.session.userUSN;
        
        const { data: existing, error: existingError } = await supabase
            .from('volunteer')
            .select('*')
            .eq('volnusn', userUSN)
            .eq('volneid', eventId)
            .limit(1);
        
        if (existingError) {
            console.error('Error checking existing volunteer:', existingError);
            return res.status(500).json({ error: 'Database error' });
        }
        
        if (existing && existing.length > 0) {
            return res.status(400).json({ error: 'Already volunteered for this event' });
        }
        
        const { data: event, error: eventError } = await supabase
            .from('event')
            .select('maxvoln')
            .eq('eid', eventId)
            .limit(1);
        
        if (eventError) {
            console.error('Error fetching event:', eventError);
            return res.status(500).json({ error: 'Database error' });
        }
        
        if (!event || event.length === 0) {
            return res.status(404).json({ error: 'Event not found' });
        }

        const maxVoln = event[0].maxvoln || 0;
        if (maxVoln > 0) {
            const { count, error: countError } = await supabase
                .from('volunteer')
                .select('*', { count: 'exact', head: true })
                .eq('volneid', eventId);

            if (countError) {
                console.error('Error counting volunteers:', countError);
                return res.status(500).json({ error: 'Database error' });
            }

            if (count >= maxVoln) {
                return res.status(400).json({ error: 'No more volunteer slots available' });
            }
        }
        
        const { error: insertError } = await supabase
            .from('volunteer')
            .insert([{
                volnusn: userUSN,
                volneid: eventId,
                volnstatus: false
            }]);
        
        if (insertError) {
            console.error('Error volunteering for event:', insertError);
            return res.status(500).json({ error: 'Database error' });
        }
        
        res.json({ success: true, message: 'Successfully volunteered for event!' });
    } catch (err) {
        console.error('Error volunteering for event:', err);
        res.status(500).json({ error: 'Error volunteering for event' });
    }
});

// Get volunteer count for an event
app.get('/api/events/:eventId/volunteer-count', requireAuth, async (req, res) => {
    try {
        const eventId = req.params.eventId;
        
        const { count, error } = await supabase
            .from('volunteer')
            .select('*', { count: 'exact', head: true })
            .eq('volneid', eventId);
        
        if (error) {
            console.error('Error fetching volunteer count:', error);
            return res.status(500).json({ error: 'Database error' });
        }
        
        res.json({ count: count || 0 });
    } catch (err) {
        console.error('Error fetching volunteer count:', err);
        res.status(500).json({ error: 'Error fetching volunteer count' });
    }
});

// Get participant count for an event
app.get('/api/events/:eventId/participant-count', requireAuth, async (req, res) => {
    try {
        const eventId = req.params.eventId;
        
        const { count, error } = await supabase
            .from('participant')
            .select('*', { count: 'exact', head: true })
            .eq('parteid', eventId);
        
        if (error) {
            console.error('Error fetching participant count:', error);
            return res.status(500).json({ error: 'Database error' });
        }
        
        res.json({ count: count || 0 });
    } catch (err) {
        console.error('Error fetching participant count:', err);
        res.status(500).json({ error: 'Error fetching participant count' });
    }
});

// Individual Event Details Route (for organizer ticket page)
app.get('/api/events/:eventId', requireAuth, async (req, res) => {
    try {
        const eventId = req.params.eventId;

        if (!eventId || isNaN(eventId)) {
            return res.status(400).json({ error: 'Invalid event ID' });
        }

        const { data: rows, error } = await supabase
            .from('event')
            .select(`
                eid, ename, eventdesc, eventdate, eventtime, eventloc, maxpart, maxvoln, regfee, orgusn,
                club:orgcid(cname),
                student:orgusn(sname)
            `)
            .eq('eid', eventId)
            .limit(1);

        if (error) {
            console.error('Error fetching event details:', error);
            return res.status(500).json({ error: 'Database error' });
        }

        if (!rows || rows.length === 0) {
            return res.status(404).json({ error: 'Event not found' });
        }

        const event = rows[0];
        
        const transformedEvent = {
            ...event,
            eventDate: event.eventdate,
            eventTime: event.eventtime,
            eventLoc: event.eventloc,
            maxPart: event.maxpart,
            maxVoln: event.maxvoln,
            regFee: event.regfee,
            clubName: event.club?.cname,
            organizerName: event.student?.sname,
            OrgUsn: event.orgusn
        };

        const { data: participantCheck } = await supabase
            .from('participant')
            .select('partstatus')
            .eq('partusn', req.session.userUSN)
            .eq('parteid', eventId)
            .limit(1);

        const { data: volunteerCheck } = await supabase
            .from('volunteer')
            .select('volnstatus')
            .eq('volnusn', req.session.userUSN)
            .eq('volneid', eventId)
            .limit(1);

        transformedEvent.isRegistered = participantCheck && participantCheck.length > 0;
        transformedEvent.isVolunteer = volunteerCheck && volunteerCheck.length > 0;
        transformedEvent.isOrganizer = event.orgusn === req.session.userUSN;

        res.json(transformedEvent);
    } catch (err) {
        console.error('Error fetching event details:', err);
        res.status(500).json({ error: 'Error fetching event details: ' + err.message });
    }
});

// Get all clubs
app.get('/api/clubs', requireAuth, async (req, res) => {
    try {
        const { data: rows, error } = await supabase
            .from('club')
            .select('cid, cname, clubdesc');
        
        if (error) {
            console.error('Error fetching clubs:', error);
            return res.status(500).json({ error: 'Database error' });
        }
        
        res.json({
            clubs: rows || [],
            userUSN: req.session.userUSN
        });
    } catch (err) {
        console.error('Error fetching clubs:', err);
        res.status(500).json({ error: 'Error fetching clubs' });
    }
});

// Get user's clubs
app.get('/api/my-clubs', requireAuth, async (req, res) => {
    try {
        const { data: rows, error } = await supabase
            .from('memberof')
            .select(`
                club:clubid (
                    cid,
                    cname,
                    clubdesc,
                    maxmembers
                )
            `)
            .eq('studentusn', req.session.userUSN);
        
        if (error) {
            console.error('Error fetching user clubs:', error);
            return res.status(500).json({ error: 'Database error' });
        }
        
        const clubs = (rows || []).map(row => row.club).filter(club => club);
        
        res.json({
            clubs: clubs,
            userUSN: req.session.userUSN
        });
    } catch (err) {
        console.error('Error fetching user clubs:', err);
        res.status(500).json({ error: 'Error fetching clubs' });
    }
});

// Get all students
app.get('/api/students', requireAuth, async (req, res) => {
    try {
        const { data: rows, error } = await supabase
            .from('student')
            .select('usn, sname, sem, mobno, emailid');
        
        if (error) {
            console.error('Error fetching students:', error);
            return res.status(500).json({ error: 'Database error' });
        }
        
        res.json({
            students: rows || [],
            currentUser: req.session.userUSN
        });
    } catch (err) {
        console.error('Error fetching students:', err);
        res.status(500).json({ error: 'Error fetching students: ' + err.message });
    }
});

// ==================== NEW ATTENDANCE ENDPOINTS ====================

// Mark participant attendance (NEW - CORRECTED)
app.post('/api/mark-participant-attendance', requireAuth, async (req, res) => {
    try {
        const { eventId, usn } = req.body;
        
        // Verify the USN matches the logged-in user
        if (usn !== req.session.userUSN) {
            return res.status(403).json({ error: 'Unauthorized: USN mismatch' });
        }
        
        if (!usn || !eventId) {
            return res.status(400).json({ error: 'USN and Event ID are required' });
        }

        // Check if participant is registered for this event
        const { data: existing, error: existingError } = await supabase
            .from('participant')
            .select('*')
            .eq('partusn', usn)
            .eq('parteid', eventId)
            .limit(1);

        if (existingError) {
            console.error('Error checking participant:', existingError);
            return res.status(500).json({ error: 'Database error' });
        }

        if (!existing || existing.length === 0) {
            return res.status(404).json({ error: 'You are not registered for this event' });
        }

        if (existing[0].partstatus === true) {
            return res.status(400).json({ error: 'Attendance already marked' });
        }

        // Mark attendance
        const { error: updateError } = await supabase
            .from('participant')
            .update({ partstatus: true })
            .eq('partusn', usn)
            .eq('parteid', eventId);
        
        if (updateError) {
            console.error('Error updating participant status:', updateError);
            return res.status(500).json({ error: 'Failed to mark attendance' });
        }

        console.log(`✅ Participant attendance marked: ${usn} for event ${eventId}`);
        res.json({ 
            success: true, 
            message: 'Participant attendance marked successfully',
            usn: usn,
            eventId: eventId
        });
    } catch (err) {
        console.error('Error marking participant attendance:', err);
        res.status(500).json({ error: 'Error marking attendance: ' + err.message });
    }
});

// Mark volunteer attendance (NEW - CORRECTED)
app.post('/api/mark-volunteer-attendance', requireAuth, async (req, res) => {
    try {
        const { eventId, usn } = req.body;
        
        // Verify the USN matches the logged-in user
        if (usn !== req.session.userUSN) {
            return res.status(403).json({ error: 'Unauthorized: USN mismatch' });
        }
        
        if (!usn || !eventId) {
            return res.status(400).json({ error: 'USN and Event ID are required' });
        }

        // Check if volunteer is registered for this event
        const { data: existing, error: existingError } = await supabase
            .from('volunteer')
            .select('*')
            .eq('volnusn', usn)
            .eq('volneid', eventId)
            .limit(1);

        if (existingError) {
            console.error('Error checking volunteer:', existingError);
            return res.status(500).json({ error: 'Database error' });
        }

        if (!existing || existing.length === 0) {
            return res.status(404).json({ error: 'You are not registered as a volunteer for this event' });
        }

        if (existing[0].volnstatus === true) {
            return res.status(400).json({ error: 'Attendance already marked' });
        }

        // Mark attendance
        const { error: updateError } = await supabase
            .from('volunteer')
            .update({ volnstatus: true })
            .eq('volnusn', usn)
            .eq('volneid', eventId);
        
        if (updateError) {
            console.error('Error updating volunteer status:', updateError);
            return res.status(500).json({ error: 'Failed to mark attendance' });
        }

        console.log(`✅ Volunteer attendance marked: ${usn} for event ${eventId}`);
        res.json({ 
            success: true, 
            message: 'Volunteer attendance marked successfully',
            usn: usn,
            eventId: eventId
        });
    } catch (err) {
        console.error('Error marking volunteer attendance:', err);
        res.status(500).json({ error: 'Error marking attendance: ' + err.message });
    }
});

// OLD scan-qr endpoint (DEPRECATED - kept for backward compatibility)
// You can remove this if you want, as the new endpoints replace it
app.get('/api/scan-qr', async (req, res) => {
    try {
        const { usn, eid } = req.query;
        
        if (!usn || !eid) {
            return res.status(400).json({ error: 'USN and Event ID are required' });
        }

        const { data: existing, error: existingError } = await supabase
            .from('participant')
            .select('*')
            .eq('partusn', usn)
            .eq('parteid', eid)
            .limit(1);

        if (existingError) {
            console.error('Error checking participant:', existingError);
            return res.status(500).json({ error: 'Database error' });
        }

        if (!existing || existing.length === 0) {
            return res.status(404).json({ error: 'Participant not found for this event' });
        }

        if (existing[0].partstatus === true) {
            return res.status(400).json({ error: 'Participant already checked in' });
        }

        const { error: updateError } = await supabase
            .from('participant')
            .update({ partstatus: true })
            .eq('partusn', usn)
            .eq('parteid', eid);
        
        if (updateError) {
            console.error('Error updating participant status:', updateError);
            return res.status(500).json({ error: 'Database error' });
        }

        res.json({ success: true, message: 'Participant status updated to checked in' });
    } catch (err) {
        console.error('Error updating participant status:', err);
        res.status(500).json({ error: 'Error updating participant status: ' + err.message });
    }
});


// ==================================================
// ADDED FORGOT/RESET PASSWORD ROUTES
// ==================================================

// Forgot Password - Send reset email
app.post('/api/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }
        // Check if user exists
        const { data: user, error: userError } = await supabase
            .from('student')
            .select('usn, sname, emailid')
            .eq('emailid', email)
            .limit(1);
        
        if (userError) {
            console.error('Error finding user:', userError);
            return res.status(500).json({ error: 'Database error' });
        }
        // Always return success (don't reveal if email exists for security)
        if (!user || user.length === 0) {
            console.log('Password reset requested for non-existent email:', email);
            return res.json({
                success: true,
                message: 'If an account exists with this email, you will receive a password reset link.'
            });
        }
        // Generate secure reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now
        // Save token to database
        const { error: updateError } = await supabase
            .from('student')
            .update({
                reset_token: resetToken,
                reset_token_expiry: resetTokenExpiry.toISOString()
            })
            .eq('emailid', email);
        
        if (updateError) {
            console.error('Error saving reset token:', updateError);
            return res.status(500).json({ error: 'Failed to generate reset link' });
        }
        // Create reset link
        const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
        // Send email
        const mailOptions = {
            from: `"E-Pass Event System" <${process.env.GMAIL_USER}>`,
            to: email,
            subject: 'Password Reset Request - E-Pass',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background: linear-gradient(to right, #1A2980, #26D0CE); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                        .button { display: inline-block; padding: 15px 30px; background: linear-gradient(to right, #1A2980, #26D0CE); color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
                        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
                        .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>🔒 Password Reset Request</h1>
                        </div>
                        <div class="content">
                            <p>Hello <strong>${user[0].sname}</strong>,</p>
                            <p>We received a request to reset the password for your account associated with <strong>${email}</strong>.</p>
                            <p>Click the button below to reset your password:</p>
                            <center>
                                <a href="${resetLink}" class="button">Reset Password</a>
                            </center>
                            <p>Or copy and paste this link into your browser:</p>
                            <p style="background: #fff; padding: 10px; border: 1px solid #ddd; word-break: break-all;">
                                ${resetLink}
                            </p>
                            <div class="warning">
                                <strong>⚠️ Important:</strong>
                                <ul>
                                    <li>This link will expire in <strong>1 hour</strong></li>
                                    <li>If you didn't request this reset, please ignore this email</li>
                                    <li>Your password won't change until you create a new one</li>
                                </ul>
                            </div>
                            <p>Your USN: <strong>${user[0].usn}</strong></p>
                        </div>
                        <div class="footer">
                            <p>E-Pass Event Management System</p>
                            <p>This is an automated email. Please do not reply.</p>
                        </div>
                    </div>
                </body>
                </html>
            `
        };
        await transporter.sendMail(mailOptions);
        console.log('✅ Password reset email sent to:', email);
        res.json({
            success: true,
            message: 'If an account exists with this email, you will receive a password reset link.'
        });
    } catch (err) {
        console.error('Error in forgot password:', err);
        res.status(500).json({ error: 'Failed to process password reset request' });
    }
});

// Reset Password - Update password with token
app.post('/api/reset-password', async (req, res) => {
    try {
        const { token, newPassword } = req.body;
        
        if (!token || !newPassword) {
            return res.status(400).json({ error: 'Token and new password are required' });
        }
        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters long' });
        }
        // Find user with valid token
        const { data: user, error: userError } = await supabase
            .from('student')
            .select('usn, sname, emailid, reset_token_expiry')
            .eq('reset_token', token)
            .limit(1);
        
        if (userError) {
            console.error('Error finding user with token:', userError);
            return res.status(500).json({ error: 'Database error' });
        }
        if (!user || user.length === 0) {
            return res.status(400).json({ error: 'Invalid or expired reset link' });
        }
        // Check if token is expired
        const tokenExpiry = new Date(user[0].reset_token_expiry);
        if (tokenExpiry < new Date()) {
            return res.status(400).json({ error: 'Reset link has expired. Please request a new one.' });
        }
        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        // Update password and clear reset token
        const { error: updateError } = await supabase
            .from('student')
            .update({
                password: hashedPassword,
                reset_token: null,
                reset_token_expiry: null
            })
            .eq('reset_token', token);
        
        if (updateError) {
            console.error('Error updating password:', updateError);
            return res.status(500).json({ error: 'Failed to reset password' });
        }
        console.log('✅ Password reset successful for:', user[0].usn);
        res.json({
            success: true,
            message: 'Password reset successfully! You can now sign in with your new password.',
            userName: user[0].sname
        });
    } catch (err) {
        console.error('Error in reset password:', err);
        res.status(500).json({ error: 'Failed to reset password' });
    }
});


// Start server
app.listen(PORT, () => {
    console.log(`\n🚀 Server running at http://localhost:${PORT}`);
    console.log(`📡 CORS enabled for http://localhost:5173`);
    console.log(`🔐 Session debugging ENABLED\n`);
});

// Razorpay setup
const Razorpay = require('razorpay');
const razorpayInstance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || '',
    key_secret: process.env.RAZORPAY_KEY_SECRET || ''
});

// Create Razorpay order for a paid event
app.post('/api/create-order', requireAuth, async (req, res) => {
    try {
        const { eventId } = req.body;
        if (!eventId) return res.status(400).json({ error: 'Event ID is required' });

        // Fetch event and fee
        const { data: rows, error } = await supabase
            .from('event')
            .select('eid, ename, regfee')
            .eq('eid', eventId)
            .limit(1);

        if (error) {
            console.error('Error fetching event for order:', error);
            return res.status(500).json({ error: 'Database error' });
        }

        if (!rows || rows.length === 0) return res.status(404).json({ error: 'Event not found' });

        const event = rows[0];
        const fee = event.regfee || 0;
        if (fee <= 0) return res.status(400).json({ error: 'This event does not require payment' });

        const amountInPaise = Math.round(Number(fee) * 100);

        const options = {
            amount: amountInPaise,
            currency: 'INR',
            receipt: `${req.session.userUSN}-${eventId}-${Date.now()}`,
            payment_capture: 1,
            notes: {
                eventId: String(eventId),
                userUSN: req.session.userUSN
            }
        };

        const order = await razorpayInstance.orders.create(options);

        if (!order) {
            console.error('Failed to create Razorpay order');
            return res.status(500).json({ error: 'Failed to create order' });
        }

        res.json({
            success: true,
            order,
            key_id: process.env.RAZORPAY_KEY_ID || ''
        });
    } catch (err) {
        console.error('Error creating Razorpay order:', err);
        res.status(500).json({ error: 'Error creating order' });
    }
});

// Verify Razorpay payment signature and register participant on success
app.post('/api/verify-payment', requireAuth, async (req, res) => {
    try {
        const { razorpay_payment_id, razorpay_order_id, razorpay_signature, eventId } = req.body;

        if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature || !eventId) {
            return res.status(400).json({ error: 'Missing required payment verification fields' });
        }

        const generated_signature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
            .update(razorpay_order_id + '|' + razorpay_payment_id)
            .digest('hex');

        if (generated_signature !== razorpay_signature) {
            console.warn('Razorpay signature mismatch', { generated_signature, razorpay_signature });
            return res.status(400).json({ error: 'Invalid payment signature' });
        }

        // At this point payment is verified. Register participant if not already.
        const userUSN = req.session.userUSN;

        const { data: existing, error: existingError } = await supabase
            .from('participant')
            .select('*')
            .eq('partusn', userUSN)
            .eq('parteid', eventId)
            .limit(1);

        if (existingError) {
            console.error('Error checking existing participant during payment verify:', existingError);
            return res.status(500).json({ error: 'Database error' });
        }

        if (existing && existing.length > 0) {
            return res.json({ success: true, message: 'Payment verified and already registered' });
        }

        const { error: insertError } = await supabase
            .from('participant')
            .insert([{
                partusn: userUSN,
                parteid: eventId,
                partstatus: false
            }]);

        if (insertError) {
            console.error('Error inserting participant after payment:', insertError);
            return res.status(500).json({ error: 'Database error' });
        }

        console.log(`✅ Payment verified and participant registered: ${userUSN} for event ${eventId}`);
        res.json({ success: true, message: 'Payment verified and registration complete' });
    } catch (err) {
        console.error('Error verifying payment:', err);
        res.status(500).json({ error: 'Error verifying payment' });
    }
});