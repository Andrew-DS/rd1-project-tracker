const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const cors = require('cors');
const sql = require('mssql');
const path = require('path');
const config = require('./config/dbconfig.js');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const port = process.env.PORT || 3000;

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

// ========================== HEALTH ==========================
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
        const result = await sql.query`SELECT Description FROM Projects`;
        res.json(result.recordset);
    } catch (err) {
        console.error('Projects error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

app.get('/ProjectEntries/:userId', async (req, res) => {
    try {
        const userId = decodeURIComponent(req.params.userId);
        await sql.connect(config);
        const result = await new sql.Request()
            .input('userId', sql.NVarChar(50), userId)
            .query(`SELECT StartDate, EndDate, Description, Hours, UserID FROM ProjectEntries WHERE UserID = @userId`);
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
            .query(`SELECT Date, PTOaccrued, PTOsubmitted FROM UserPTO WHERE UserID = @userId ORDER BY Date`);
        res.json(result.recordset);
    } catch (err) {
        console.error('UserPTO error:', err.message);
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
        console.error('SubmittedWeeks error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

app.get('/sql-status', async (req, res) => {
    try {
        await sql.connect(config);
        const result = await sql.query`SELECT GETDATE() AS now`;
        res.json({ success: true, result: result.recordset });
    } catch (err) {
        console.error('SQL Status check failed:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ========================== POST ROUTES ==========================
app.post('/Login', async (req, res) => {
    const { username, password } = req.body;
    try {
        await sql.connect(config);
        const result = await sql.query`SELECT * FROM Users WHERE Username = ${username}`;
        if (result.recordset.length === 0) return res.status(401).json({ success: false, error: 'Invalid username or password.' });

        const user = result.recordset[0];
        if (!user.Password) return res.status(500).json({ success: false, error: 'Password not found for user.' });

        const isMatch = await bcrypt.compare(password, user.Password);
        if (!isMatch) return res.status(401).json({ success: false, error: 'Invalid username or password.' });

        res.json({ success: true, user: { username: user.Username, role: user.Role || 'username' } });
    } catch (err) {
        console.error('Login error:', err.stack || err);
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
            const conflict = existingUser.Username === username ? 'username' : 'email';
            return res.json({ exists: true, conflict });
        }
        res.json({ exists: false });
    } catch (err) {
        console.error('CheckUserExists error:', err);
        res.status(500).json({ error: err.message });
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
        res.status(500).json({ error: err.message });
    }
});

app.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    try {
        await sql.connect(config);
        const findUser = await new sql.Request()
            .input('email', sql.NVarChar, email)
            .query('SELECT * FROM Users WHERE EmailAddress = @email');
        if (findUser.recordset.length === 0) return res.json({ message: 'If your email exists, a reset link has been sent.' });

        const token = crypto.randomBytes(32).toString('hex');
        const expiry = new Date(Date.now() + 3600000); // 1 hour

        await new sql.Request()
            .input('email', sql.NVarChar, email)
            .input('token', sql.NVarChar, token)
            .input('expiry', sql.DateTime, expiry)
            .query(`
                UPDATE Users SET ResetToken = @token, ResetTokenExpiry = @expiry WHERE EmailAddress = @email
            `);

        console.log(`Send this reset link to ${email}: http://yourapp.com/reset-password?token=${token}`);
        res.json({ message: 'If your email exists, a reset link has been sent.' });
    } catch (err) {
        console.error('Forgot password error:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/ResetPassword', async (req, res) => {
    const { email, newPassword } = req.body;
    if (!email || !newPassword) return res.status(400).json({ error: 'Email and new password are required.' });

    try {
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await sql.connect(config);
        const result = await new sql.Request()
            .input('email', sql.NVarChar, email)
            .input('password', sql.NVarChar, hashedPassword)
            .query('UPDATE Users SET Password = @password WHERE EmailAddress = @email');
        if (result.rowsAffected[0] === 0) return res.status(404).json({ error: 'User not found.' });

        res.json({ success: true, message: 'Password reset successfully.' });
    } catch (err) {
        console.error('Reset password error:', err.message);
        res.status(500).json({ error: 'An error occurred while resetting password.' });
    }
});

app.post('/AddProjectEntry', async (req, res) => {
    try {
        const { Description, Hours, StartDate, EndDate, UserID } = req.body;
        await sql.connect(config);
        await new sql.Request()
            .input('desc', sql.NVarChar, Description)
            .input('hours', sql.Numeric(18, 2), Hours)
            .input('start', sql.Date, StartDate)
            .input('end', sql.Date, EndDate)
            .input('userId', sql.NVarChar, UserID)
            .query(`
                INSERT INTO ProjectEntries (Description, Hours, StartDate, EndDate, UserID)
                VALUES (@desc, @hours, @start, @end, @userId)
            `);
        res.json({ success: true });
    } catch (err) {
        console.error('Insert ProjectEntry error:', err.message);
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
        console.error('SubmitWeek error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

app.post('/AddProject', async (req, res) => {
    const { Description } = req.body;
    if (!Description || typeof Description !== 'string' || !Description.trim()) {
        return res.status(400).json({ success: false, error: 'Invalid category description.' });
    }

    try {
        await sql.connect(config);
        const existsResult = await new sql.Request()
            .input('desc', sql.NVarChar, Description)
            .query('SELECT COUNT(*) AS count FROM Projects WHERE Description = @desc');
        if (existsResult.recordset[0].count > 0) {
            return res.status(400).json({ success: false, error: 'Category already exists.' });
        }

        await new sql.Request()
            .input('desc', sql.NVarChar, Description)
            .query('INSERT INTO Projects (Description) VALUES (@desc)');
        res.json({ success: true });
    } catch (err) {
        console.error('AddProject error:', err.message);
        res.status(500).json({ success: false, error: 'Database error' });
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
        console.error('AddUserPTO error:', err.message);
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
        console.error('RemoveEntry error:', err);
        res.status(500).json({ success: false, error: 'Failed to remove entry.' });
    }
});

app.delete('/RemoveProject/:description', async (req, res) => {
    const description = decodeURIComponent(req.params.description);
    if (!description || description.toLowerCase() === 'pto request') {
        return res.status(400).json({ error: 'Cannot remove this category.' });
    }

    try {
        await sql.connect(config);
        await new sql.Request()
            .input('desc', sql.NVarChar(255), description)
            .query('DELETE FROM Projects WHERE Description = @desc');
        res.json({ success: true });
    } catch (err) {
        console.error('RemoveProject error:', err.message);
        res.status(500).json({ error: 'Failed to remove category.' });
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
        console.error('DeleteUserPTO error:', err.message);
        res.status(500).json({ error: 'Failed to delete PTO entry.' });
    }
});
