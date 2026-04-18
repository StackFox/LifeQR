import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

// Test 1: Simple route
app.get('/test1', (_req, res) => {
    res.json({ test: 1, works: true });
});

// Test 2: Parameterized route
app.get('/test2/:id', (req, res) => {
    res.json({ test: 2, id: req.params.id });
});

// Test 3: API prefix simple
app.get('/api/test3', (_req, res) => {
    res.json({ test: 3, works: true });
});

// Test 4: API prefix with param
app.get('/api/test4/:id', (req, res) => {
    res.json({ test: 4, id: req.params.id });
});

const port = 5001;
app.listen(port, () => {
    console.log(`Test server running on port ${port}`);
    console.log('Available routes:');
    console.log('  GET /test1');
    console.log('  GET /test2/:id');
    console.log('  GET /api/test3');
    console.log('  GET /api/test4/:id');
});
