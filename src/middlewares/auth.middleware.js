const jwt = require('jsonwebtoken');

const authenticate = (req, res, next) =>{
    try{
        const authHeader = req.headers.authorization;
        if(!authHeader || !authHeader.startsWith('Bearer ')){
            return res.status(401).json({
                status: 'error',
                message: 'Unauthorized'
            })
        }
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    }catch(err){
        console.error('Authentication error', err.message);
        res.status(401).json({
            status: 'error',
            message: 'Unauthorized'
        })
    }
}

const authorize = (...roles)=>{
    return (req, res, next)=>{
        if(!roles.includes(req.user.role)){
            return res.status(403).json({
                status: 'error',
                message: 'Forbidden'
            })
        }
        next();
    }
}

module.exports = { authenticate, authorize };