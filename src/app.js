const express = require('express');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true}));

const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,             // 60 requests per IP
  message: { message: 'Too many requests, please try again later.' }
});
const authRoutes = require('./routes/auth.routes.js');
app.use('/auth', authRoutes);

const contentRoutes = require('./routes/content.routes');
app.use('/content', contentRoutes);

const approvalRoutes = require('./routes/approval.routes');
app.use('/approval', approvalRoutes);

const broadcastRoutes = require('./routes/broadcast.routes');
app.use('/content/live', limiter);    
app.use('/content', broadcastRoutes);

app.get('/health', (req,res)=>{
    res.json({
        status: 'ok',
        message: 'Server is healthy'
    })
})

module.exports = app;