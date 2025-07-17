const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const cors = require('cors');
const sql = require('mssql');
const app = express();
app.use(cors());
app.use(express.json());

const config = require('./config/dbconfig.js');
const path = require('path');
app.use(express.static(path.join(__dirname, 'public')));

// Dynamically use the PORT provided by Azure, or default to 3000 for local development
const port = process.env.PORT || 3000;  // Use Azure's dynamic port in production, fallback to 3000 locally

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

// Health check route for Azure
app.get('/health', (req, res) => {
    res.status(200).send('Healthy');
});

// ========================== GET ROUTES ==========================

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/Projects', async (req, res) => {
    try {
        await sql.connect(config);
        const result = await sql.query`SELECT Description FROM Projects;`;
        res.json(result.recordset);
    } catch (err) {
        console.error('SQL error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

app.get('/ProjectEntries/:userId', async (req, res) => {
    try {
        const userId = decodeURIComponent(req.params.userId);
        await sql.connect(config);
        const result = await new sql.Request()
            .input('userId', sql.NVarChar(50), userId)
            .query(`
                SELECT StartDate, EndDate, Description, Hours, UserID
                FROM ProjectEntries
                WHERE UserID = @userId
            `);
        res.json(result.recordset || []);
    } catch {
        res.json([]);
    }
});

app.get('/UserPTO/:userId', async (req, res) => {
    try {
        const userId = decodeURIComponent(req.params.userId);
        await sql.connect(config);
        const result = await new sql.Request()
            .input('userId', sql.NVarChar(50), userId)
            .query(`
                SELECT Date, PTOaccrued, PTOsubmitted
                FROM UserPTO
                WHERE UserID = @userId ORDER BY DATE
            `);
        res.json(result.recordset);
    } catch (err) {
        console.error('PTO query error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

app.get('/SubmittedWeeks/:userId', async (req, res) => {
    try {
        const userId = decodeURIComponent(req.params.userId);
        await sql.connect(config);
        const result = await new sql.Request()
            .input('userId', sql.NVarChar(50), userId)
            .query(`SELECT WeekStart, WeekEnd FROM SubmittedWeeks WHERE UserID = @userId`);
        res.json(result.recordset);
    } catch (err) {
        console.error('SubmittedWeeks GET error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ========================== POST ROUTES ==========================

app.post('/Login', async (req, res) => {
    const { username, password } = req.body;

    try {
        await sql.connect(config);
        const result = await sql.query`SELECT * FROM Users WHERE Username = ${username}`;

        if (result.recordset.length === 0) {
            return res.status(401).json({ success: false, error: 'Invalid username or password.' });
        }

        const user = result.recordset[0];
        const isMatch = await bcrypt.compare(password, user.Password);

        if (!user.Password) {
            return res.status(500).json({ success: false, error: 'Password not found for user.' });
        }

        if (!isMatch) {
            return res.status(401).json({ success: false, error: 'Invalid username or password.' });
        }

        res.json({ success: true, user: { username: user.Username, role: user.Role || 'username' } });

    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

app.post('/CheckUserExists', async (req, res) => {
    const { username, email } = req.body;

    try {
        await sql.connect(config);
        const result = await sql.query`
            SELECT * FROM Users WHERE Username = ${username} OR EmailAddress = ${email}
        `;

        if (result.recordset.length > 0) {
            const existingUser = result.recordset[0];
            const conflict = (existingUser.Username === username) ? 'username' : 'email';
            return res.json({ exists: true, conflict });
        }

        res.json({ exists: false });
    } catch (err) {
        console.error('CheckUserExists error:', err);
        res.status(500).json({ error: 'Server error while checking user.' });
    }
});

app.post('/Register', async (req, res) => {
    const { username, password, email, firstName, lastName } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    try {
        await sql.connect(config);
        await new sql.Request()
            .input('username', sql.NVarChar, username)
            .input('hashedPassword', sql.NVarChar, hashedPassword)
            .input('email', sql.NVarChar, email)
            .input('firstName', sql.NVarChar, firstName)
            .input('lastName', sql.NVarChar, lastName)
            .query(`
                INSERT INTO Users (Username, Password, EmailAddress, FirstName, LastName)
                VALUES (@username, @hashedPassword, @email, @firstName, @lastName)
            `);

        res.json({ success: true });
    } catch (err) {
        console.error('Registration error:', err);
        res.status(500).json({ error: 'Registration failed' });
    }
});

app.post('/AddProjectEntry', async (req, res) => {
    try {
        const { Description, Hours, StartDate, EndDate, UserID } = req.body;

        const query = `
            INSERT INTO ProjectEntries (Description, Hours, StartDate, EndDate, UserID)
            VALUES (@desc, @hours, @start, @end, @userId)
        `;

        await sql.connect(config);
        const request = new sql.Request();

        await request
            .input('desc', sql.NVarChar, Description)
            .input('hours', sql.Numeric(18, 2), Hours)
            .input('start', sql.Date, StartDate)
            .input('end', sql.Date, EndDate)
            .input('userId', sql.NVarChar, UserID)
            .query(query);

        res.json({ success: true });
    } catch (err) {
        console.error('Insert error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

app.post('/AddUserPTO', async (req, res) => {
    try {
        const { UserID, Date, PTOaccrued, PTOsubmitted } = req.body;

        await sql.connect(config);

        await new sql.Request()
            .input('UserID', sql.NVarChar(50), UserID)
            .input('Date', sql.Date, Date)
            .input('PTOaccrued', sql.Numeric(18, 2), PTOaccrued - PTOsubmitted)
            .input('PTOsubmitted', sql.Numeric(18, 2), PTOsubmitted)
            .query(`
                INSERT INTO UserPTO (UserID, Date, PTOaccrued, PTOsubmitted)
                VALUES (@UserID, @Date, @PTOaccrued, @PTOsubmitted)
            `);

        res.json({ success: true });
    } catch (err) {
        console.error('SQL Insert PTO error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

app.post('/SubmitWeek', async (req, res) => {
    const { UserID, WeekStart, WeekEnd } = req.body;

    try {
        await sql.connect(config);
        await new sql.Request()
            .input('UserID', sql.NVarChar(50), UserID)
            .input('WeekStart', sql.Date, WeekStart)
            .input('WeekEnd', sql.Date, WeekEnd)
            .query(`INSERT INTO SubmittedWeeks (UserID, WeekStart, WeekEnd) VALUES (@UserID, @WeekStart, @WeekEnd)`);

        res.json({ success: true });
    } catch (err) {
        console.error('SubmitWeek POST error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ========================== DELETE ROUTES ==========================

app.delete('/RemoveEntry', async (req, res) => {
    const { Description, Date } = req.body;

    try {
        await sql.connect(config);
        await new sql.Request()
            .input('Description', sql.NVarChar, Description)
            .input('Date', sql.Date, Date)
            .query(`
                DELETE FROM ProjectEntries
                WHERE Description = @Description AND StartDate <= @Date AND EndDate >= @Date
            `);

        res.json({ success: true });
    } catch (err) {
        console.error('Remove entry error:', err);
        res.status(500).json({ success: false, error: 'Failed to remove entry.' });
    }
});

app.delete('/DeleteUserPTO', async (req, res) => {
    const { UserID, Date } = req.body;

    if (!UserID || !Date) {
        return res.status(400).json({ error: 'Missing parameters' });
    }

    try {
        await sql.connect(config);

        await new sql.Request()
            .input('UserID', sql.NVarChar(50), UserID)
            .input('Date', sql.Date, Date)
            .query(`DELETE FROM UserPTO WHERE UserID = @UserID AND Date = @Date`);

        res.json({ success: true });
    } catch (err) {
        console.error('Delete PTO error:', err.message);
        res.status(500).json({ error: 'Failed to delete PTO entry.' });
    }
});

// ========================== EXPORT ==========================

// Export the app to allow Azure to start it
module.exports = app;