const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// Create uploads directory
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

// File upload configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage });

// Initialize Database
const db = new sqlite3.Database('./database/shubham_greens.db', (err) => {
    if (err) {
        console.error('Error opening database:', err);
    } else {
        console.log('Connected to SQLite database');
        initializeDatabase();
    }
});

// Create database tables
function initializeDatabase() {
    db.serialize(() => {
        // Properties table
        db.run(`CREATE TABLE IF NOT EXISTS properties (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT,
            location TEXT NOT NULL,
            area REAL NOT NULL,
            area_unit TEXT DEFAULT 'Acres',
            price REAL NOT NULL,
            property_type TEXT NOT NULL,
            water_source TEXT,
            status TEXT DEFAULT 'Available',
            survey_number TEXT,
            khasra_number TEXT,
            image_url TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Clients table
        db.run(`CREATE TABLE IF NOT EXISTS clients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            phone TEXT,
            password TEXT NOT NULL,
            address TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Purchases table
        db.run(`CREATE TABLE IF NOT EXISTS purchases (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id INTEGER NOT NULL,
            property_id INTEGER NOT NULL,
            purchase_date DATE NOT NULL,
            total_amount REAL NOT NULL,
            amount_paid REAL DEFAULT 0,
            registry_number TEXT,
            registry_date DATE,
            registry_status TEXT DEFAULT 'Pending',
            mutation_status TEXT DEFAULT 'Pending',
            property_id_number TEXT,
            FOREIGN KEY (client_id) REFERENCES clients(id),
            FOREIGN KEY (property_id) REFERENCES properties(id)
        )`);

        // Payments table
        db.run(`CREATE TABLE IF NOT EXISTS payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            purchase_id INTEGER NOT NULL,
            amount REAL NOT NULL,
            payment_date DATE NOT NULL,
            payment_type TEXT NOT NULL,
            status TEXT DEFAULT 'Completed',
            transaction_id TEXT,
            notes TEXT,
            FOREIGN KEY (purchase_id) REFERENCES purchases(id)
        )`);

        // Documents table
        db.run(`CREATE TABLE IF NOT EXISTS documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            purchase_id INTEGER NOT NULL,
            document_name TEXT NOT NULL,
            document_type TEXT NOT NULL,
            file_path TEXT NOT NULL,
            upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (purchase_id) REFERENCES documents(id)
        )`);

        // Insert sample data
        insertSampleData();
    });
}

// Insert sample data
function insertSampleData() {
    // Check if properties exist
    db.get('SELECT COUNT(*) as count FROM properties', [], (err, row) => {
        if (row.count === 0) {
            const properties = [
                {
                    title: 'Green Valley Estate',
                    description: 'Beautiful 5-acre agricultural land in serene Neemrana. Perfect for farmhouse development or organic farming. Year-round water supply from borewell.',
                    location: 'Neemrana, Rajasthan',
                    area: 5,
                    price: 4500000,
                    property_type: 'Agricultural',
                    water_source: 'Borewell',
                    survey_number: '234/5',
                    khasra_number: '567'
                },
                {
                    title: 'Riverside Retreat',
                    description: '8-acre premium farmhouse property with river access. Includes existing structure and well-maintained gardens.',
                    location: 'Karjat, Maharashtra',
                    area: 8,
                    price: 12000000,
                    property_type: 'Farmhouse',
                    water_source: 'River + Well',
                    survey_number: '156/3',
                    khasra_number: '892'
                },
                {
                    title: 'Sunset Hills Farm',
                    description: '3-acre NA plot with corporation water connection. Ready for construction with clear title.',
                    location: 'Lonavala, Maharashtra',
                    area: 3,
                    price: 7500000,
                    property_type: 'NA Plot',
                    water_source: 'Corporation',
                    survey_number: '789/2',
                    khasra_number: '345'
                }
            ];

            const stmt = db.prepare(`INSERT INTO properties 
                (title, description, location, area, price, property_type, water_source, survey_number, khasra_number) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);

            properties.forEach(prop => {
                stmt.run([
                    prop.title,
                    prop.description,
                    prop.location,
                    prop.area,
                    prop.price,
                    prop.property_type,
                    prop.water_source,
                    prop.survey_number,
                    prop.khasra_number
                ]);
            });
            stmt.finalize();

            // Create demo client
            const hashedPassword = bcrypt.hashSync('demo123', 10);
            db.run(`INSERT INTO clients (name, email, phone, password, address) 
                VALUES (?, ?, ?, ?, ?)`,
                ['Rajesh Kumar', 'demo@shubhamgreens.com', '+91 98765 43210', hashedPassword, 'Bhopal, Madhya Pradesh'],
                function(err) {
                    if (err) return;
                    
                    const clientId = this.lastID;
                    
                    // Create a purchase for demo client
                    db.run(`INSERT INTO purchases 
                        (client_id, property_id, purchase_date, total_amount, amount_paid, registry_number, registry_date, registry_status, mutation_status, property_id_number) 
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [clientId, 1, '2026-01-15', 4500000, 2500000, 'RJ/2026/1234', '2026-01-20', 'Completed', 'Completed', 'PROP-2026-234'],
                        function(err) {
                            if (err) return;
                            
                            const purchaseId = this.lastID;
                            
                            // Add payment records
                            const payments = [
                                { amount: 500000, date: '2026-01-01', type: 'Token Amount', status: 'Completed', txn: 'TXN001' },
                                { amount: 2000000, date: '2026-01-15', type: 'First Installment', status: 'Completed', txn: 'TXN002' },
                                { amount: 1000000, date: '2026-02-15', type: 'Second Installment', status: 'Upcoming', txn: '' },
                                { amount: 1000000, date: '2026-03-15', type: 'Final Payment', status: 'Upcoming', txn: '' }
                            ];
                            
                            const paymentStmt = db.prepare(`INSERT INTO payments 
                                (purchase_id, amount, payment_date, payment_type, status, transaction_id) 
                                VALUES (?, ?, ?, ?, ?, ?)`);
                            
                            payments.forEach(p => {
                                paymentStmt.run([purchaseId, p.amount, p.date, p.type, p.status, p.txn]);
                            });
                            paymentStmt.finalize();
                        }
                    );
                }
            );
        }
    });
}

// Authentication middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
}

// ============= API ROUTES =============

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Shubham Greens API is running' });
});

// Get all properties
app.get('/api/properties', (req, res) => {
    db.all('SELECT * FROM properties WHERE status = ?', ['Available'], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// Get single property
app.get('/api/properties/:id', (req, res) => {
    db.get('SELECT * FROM properties WHERE id = ?', [req.params.id], (err, row) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (!row) {
            return res.status(404).json({ error: 'Property not found' });
        }
        res.json(row);
    });
});

// Add new property (admin only - simplified for demo)
app.post('/api/properties', upload.single('image'), (req, res) => {
    const { title, description, location, area, price, property_type, water_source, survey_number, khasra_number } = req.body;
    const image_url = req.file ? `/uploads/${req.file.filename}` : null;

    db.run(`INSERT INTO properties 
        (title, description, location, area, price, property_type, water_source, survey_number, khasra_number, image_url) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [title, description, location, area, price, property_type, water_source, survey_number, khasra_number, image_url],
        function(err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json({ id: this.lastID, message: 'Property added successfully' });
        }
    );
});

// Client login
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;

    db.get('SELECT * FROM clients WHERE email = ?', [email], (err, client) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (!client) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        if (bcrypt.compareSync(password, client.password)) {
            const token = jwt.sign({ id: client.id, email: client.email }, JWT_SECRET, { expiresIn: '24h' });
            res.json({
                token,
                client: {
                    id: client.id,
                    name: client.name,
                    email: client.email,
                    phone: client.phone
                }
            });
        } else {
            res.status(401).json({ error: 'Invalid credentials' });
        }
    });
});

// Client registration
app.post('/api/register', (req, res) => {
    const { name, email, phone, password, address } = req.body;
    const hashedPassword = bcrypt.hashSync(password, 10);

    db.run(`INSERT INTO clients (name, email, phone, password, address) VALUES (?, ?, ?, ?, ?)`,
        [name, email, phone, hashedPassword, address],
        function(err) {
            if (err) {
                if (err.message.includes('UNIQUE')) {
                    return res.status(400).json({ error: 'Email already registered' });
                }
                return res.status(500).json({ error: err.message });
            }
            res.json({ id: this.lastID, message: 'Registration successful' });
        }
    );
});

// Get client dashboard data
app.get('/api/client/dashboard', authenticateToken, (req, res) => {
    const clientId = req.user.id;

    db.get(`
        SELECT 
            c.*,
            p.id as property_id,
            p.title as property_title,
            p.location as property_location,
            p.area as property_area,
            pur.purchase_date,
            pur.total_amount,
            pur.amount_paid,
            pur.registry_number,
            pur.registry_date,
            pur.registry_status,
            pur.mutation_status,
            pur.property_id_number,
            p.survey_number,
            p.khasra_number,
            p.property_type
        FROM clients c
        LEFT JOIN purchases pur ON c.id = pur.client_id
        LEFT JOIN properties p ON pur.property_id = p.id
        WHERE c.id = ?
    `, [clientId], (err, data) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(data);
    });
});

// Get client payments
app.get('/api/client/payments', authenticateToken, (req, res) => {
    const clientId = req.user.id;

    db.all(`
        SELECT pay.*
        FROM payments pay
        JOIN purchases pur ON pay.purchase_id = pur.id
        WHERE pur.client_id = ?
        ORDER BY pay.payment_date
    `, [clientId], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// Get client documents
app.get('/api/client/documents', authenticateToken, (req, res) => {
    const clientId = req.user.id;

    db.all(`
        SELECT doc.*
        FROM documents doc
        JOIN purchases pur ON doc.purchase_id = pur.id
        WHERE pur.client_id = ?
        ORDER BY doc.upload_date DESC
    `, [clientId], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// Upload document
app.post('/api/documents', authenticateToken, upload.single('document'), (req, res) => {
    const { purchase_id, document_name, document_type } = req.body;
    const file_path = req.file ? `/uploads/${req.file.filename}` : null;

    if (!file_path) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    db.run(`INSERT INTO documents (purchase_id, document_name, document_type, file_path) 
        VALUES (?, ?, ?, ?)`,
        [purchase_id, document_name, document_type, file_path],
        function(err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json({ id: this.lastID, message: 'Document uploaded successfully' });
        }
    );
});

// Contact form (can be extended to save to database or send email)
app.post('/api/contact', (req, res) => {
    const { name, email, phone, message } = req.body;
    
    // Here you would typically send an email or save to database
    console.log('Contact form submission:', { name, email, phone, message });
    
    res.json({ message: 'Thank you for contacting us. We will get back to you soon!' });
});

// ============= ADMIN ENDPOINTS =============

// Admin middleware (simplified - in production use proper authentication)
function authenticateAdmin(req, res, next) {
    const authHeader = req.headers['authorization'];
    // For demo purposes, we'll accept any authorization header
    // In production, implement proper admin JWT validation
    next();
}

// Get all clients (admin only)
app.get('/api/admin/clients', authenticateAdmin, (req, res) => {
    db.all('SELECT id, name, email, phone, address, created_at FROM clients', [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// Get all purchases (admin only)
app.get('/api/admin/purchases', authenticateAdmin, (req, res) => {
    db.all(`
        SELECT 
            pur.*,
            c.name as client_name,
            c.email as client_email,
            p.title as property_title,
            p.location as property_location
        FROM purchases pur
        JOIN clients c ON pur.client_id = c.id
        JOIN properties p ON pur.property_id = p.id
        ORDER BY pur.purchase_date DESC
    `, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// Get all payments (admin only)
app.get('/api/admin/payments', authenticateAdmin, (req, res) => {
    db.all(`
        SELECT 
            pay.*,
            pur.client_id,
            c.name as client_name,
            p.title as property_title
        FROM payments pay
        JOIN purchases pur ON pay.purchase_id = pur.id
        JOIN clients c ON pur.client_id = c.id
        JOIN properties p ON pur.property_id = p.id
        ORDER BY pay.payment_date DESC
    `, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// Get all documents (admin only)
app.get('/api/admin/documents', authenticateAdmin, (req, res) => {
    db.all(`
        SELECT 
            doc.*,
            pur.client_id,
            c.name as client_name,
            p.title as property_title
        FROM documents doc
        JOIN purchases pur ON doc.purchase_id = pur.id
        JOIN clients c ON pur.client_id = c.id
        JOIN properties p ON pur.property_id = p.id
        ORDER BY doc.upload_date DESC
    `, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// Update property (admin only)
app.put('/api/admin/properties/:id', authenticateAdmin, (req, res) => {
    const { id } = req.params;
    const { title, description, location, area, price, property_type, water_source, status, survey_number, khasra_number } = req.body;
    
    db.run(`UPDATE properties 
        SET title = ?, description = ?, location = ?, area = ?, price = ?, 
            property_type = ?, water_source = ?, status = ?, survey_number = ?, khasra_number = ?
        WHERE id = ?`,
        [title, description, location, area, price, property_type, water_source, status, survey_number, khasra_number, id],
        function(err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json({ message: 'Property updated successfully' });
        }
    );
});

// Delete property (admin only)
app.delete('/api/admin/properties/:id', authenticateAdmin, (req, res) => {
    const { id } = req.params;
    
    db.run('DELETE FROM properties WHERE id = ?', [id], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ message: 'Property deleted successfully' });
    });
});

// Update client (admin only)
app.put('/api/admin/clients/:id', authenticateAdmin, (req, res) => {
    const { id } = req.params;
    const { name, email, phone, address } = req.body;
    
    db.run(`UPDATE clients SET name = ?, email = ?, phone = ?, address = ? WHERE id = ?`,
        [name, email, phone, address, id],
        function(err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json({ message: 'Client updated successfully' });
        }
    );
});

// Reset client password (admin only)
app.post('/api/admin/clients/:id/reset-password', authenticateAdmin, (req, res) => {
    const { id } = req.params;
    const { newPassword } = req.body;
    
    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    
    db.run('UPDATE clients SET password = ? WHERE id = ?', [hashedPassword, id], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ message: 'Password reset successfully' });
    });
});

// Delete client (admin only)
app.delete('/api/admin/clients/:id', authenticateAdmin, (req, res) => {
    const { id } = req.params;
    
    db.run('DELETE FROM clients WHERE id = ?', [id], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ message: 'Client deleted successfully' });
    });
});

// Add purchase (admin only)
app.post('/api/admin/purchases', authenticateAdmin, (req, res) => {
    const { client_id, property_id, purchase_date, total_amount, amount_paid, registry_number, registry_date, registry_status, mutation_status, property_id_number } = req.body;
    
    db.run(`INSERT INTO purchases 
        (client_id, property_id, purchase_date, total_amount, amount_paid, registry_number, registry_date, registry_status, mutation_status, property_id_number)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [client_id, property_id, purchase_date, total_amount, amount_paid || 0, registry_number, registry_date, registry_status || 'Pending', mutation_status || 'Pending', property_id_number],
        function(err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json({ id: this.lastID, message: 'Purchase added successfully' });
        }
    );
});

// Update purchase (admin only)
app.put('/api/admin/purchases/:id', authenticateAdmin, (req, res) => {
    const { id } = req.params;
    const { total_amount, amount_paid, registry_number, registry_date, registry_status, mutation_status, property_id_number } = req.body;
    
    db.run(`UPDATE purchases 
        SET total_amount = ?, amount_paid = ?, registry_number = ?, registry_date = ?, 
            registry_status = ?, mutation_status = ?, property_id_number = ?
        WHERE id = ?`,
        [total_amount, amount_paid, registry_number, registry_date, registry_status, mutation_status, property_id_number, id],
        function(err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json({ message: 'Purchase updated successfully' });
        }
    );
});

// Add payment (admin only)
app.post('/api/admin/payments', authenticateAdmin, (req, res) => {
    const { purchase_id, amount, payment_date, payment_type, status, transaction_id, notes } = req.body;
    
    db.run(`INSERT INTO payments (purchase_id, amount, payment_date, payment_type, status, transaction_id, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [purchase_id, amount, payment_date, payment_type, status || 'Completed', transaction_id, notes],
        function(err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            
            // Update amount_paid in purchases table
            db.run(`UPDATE purchases 
                SET amount_paid = amount_paid + ? 
                WHERE id = ?`, [amount, purchase_id]);
            
            res.json({ id: this.lastID, message: 'Payment added successfully' });
        }
    );
});

// Delete payment (admin only)
app.delete('/api/admin/payments/:id', authenticateAdmin, (req, res) => {
    const { id } = req.params;
    
    // First get the payment details to update purchase
    db.get('SELECT purchase_id, amount FROM payments WHERE id = ?', [id], (err, payment) => {
        if (err || !payment) {
            return res.status(500).json({ error: 'Payment not found' });
        }
        
        // Delete payment
        db.run('DELETE FROM payments WHERE id = ?', [id], function(err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            
            // Update amount_paid in purchases
            db.run(`UPDATE purchases 
                SET amount_paid = amount_paid - ? 
                WHERE id = ?`, [payment.amount, payment.purchase_id]);
            
            res.json({ message: 'Payment deleted successfully' });
        });
    });
});

// Dashboard stats (admin only)
app.get('/api/admin/stats', authenticateAdmin, (req, res) => {
    const stats = {};
    
    db.get('SELECT COUNT(*) as count FROM properties', [], (err, row) => {
        stats.properties = row ? row.count : 0;
        
        db.get('SELECT COUNT(*) as count FROM clients', [], (err, row) => {
            stats.clients = row ? row.count : 0;
            
            db.get('SELECT COUNT(*) as count FROM purchases', [], (err, row) => {
                stats.purchases = row ? row.count : 0;
                
                db.get('SELECT COUNT(*) as count FROM payments WHERE status = ?', ['Pending'], (err, row) => {
                    stats.pendingPayments = row ? row.count : 0;
                    
                    res.json(stats);
                });
            });
        });
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Shubham Greens server running on port ${PORT}`);
    console.log(`API: http://localhost:${PORT}/api`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    db.close((err) => {
        if (err) {
            console.error(err.message);
        }
        console.log('Database connection closed');
        process.exit(0);
    });
});
