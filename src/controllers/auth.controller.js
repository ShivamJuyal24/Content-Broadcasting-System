const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const db = require('../models/db.js');

const register = async (req, res)=>{
   const { name , email, password, role} = req.body;
   if(!['principal', 'teacher'].includes(role)){
        return res.status(400).json({
            status: 'error',
            message: 'Invalid role. Role must be either principal or teacher'
        })
   }
    try{
        const existingUser = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        if(existingUser.rows.length > 0){
            return res.status(400).json({
                status: 'error',
                message: 'User with this email already exists'
            })
        }
        const passwordHash = await bcrypt.hash(password, 10);
        const result = await db.query('INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role', [name, email, passwordHash, role]);
        const user = result.rows[0];
        const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '24h' });
        return res.status(201).json({
            status: 'success',
            message: 'User registered successfully',
            data: {
                user,
                token
            }
        })
    }
    catch(err){ 
        console.error("Error registering user", err);
        return res.status(500).json({
            status:'error',
            message:'Internal Server Error'
        })    
    }
}

const login = async (req, res) =>{
    const {email, password} = req.body;

    try{
        const result = await db.query('SELECT * FROM users WHERE email = $1',[email]);
        const user = result.rows[0];

        if(!user) return res.status(401).json({message:'Invalid credentials'});

        const match = await bcrypt.compare(password, user.password_hash);

        if(!match){
            return res.status(401).json({message:'Invalid credentials'});
        }
        const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '24h' });
        return res.json({
            status: 'success',
            token,
            user:{
                id:user.id, name: user.name, email: user.email, role: user.role}
            })
    }catch(err){
        res.status(500).json({
            message:'Internal Server Error'
        })
    }
}

module.exports = { register, login};