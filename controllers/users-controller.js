// const {v4: uuidv4} = require('uuid');
const { validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const HttpError = require('../models/http-error');
const User = require('../models/user-model');

exports.getAllUsers = async function (req,res,next){
    let users;
    try {
        users = await User.find({}, '-password');
    }catch(err){
        return next(new HttpError('Error fetching users, please try again later', 500));
    }

    res.json({users: users.map(u => u.toObject({getters: true}))});
}

exports.signup = async function (req,res,next){
    const errors = validationResult(req);
    if(!errors.isEmpty()){
        console.log(errors);
        return next(new HttpError('Invalid inputs passed, please check your data', 422));
    }
    const {name,email,password} = req.body;
    let userExists;
    try{
        userExists = await User.findOne({email: email});
    }catch(err){
        return next(new HttpError('Signing up failed, please try again later.', 500));
    }

    if(userExists){
        return next(new HttpError('Could not create user, email already exists.', 422));
    }

    let hashedPassword;
    try{
        hashedPassword = await bcrypt.hash(password,12);
    }catch(err){
        return next(new HttpError('Could not create user, please try again.',500));
    }

    const newUser = new User({
        name,
        email,
        password: hashedPassword,
        places: [],
        image: req.file.path
    });

    try{
        await newUser.save();
    }catch(err){
        return next(new HttpError('Signing up failed, please try again later',500));
    }

    let token;
    try{
        token = jwt.sign({userId: newUser.id, email: newUser.email}, process.env.JWT_KEY,{expiresIn: '1h'});
    }catch(err){
        return next(new HttpError('Signing up failed, please try again later',500));
    }

    res.status(201).json({userId: newUser.id, email: newUser.email, token: token});
}

exports.login = async function (req,res,next){
    const {email,password } = req.body;
    let identifiedUser;
    try{
        identifiedUser = await User.findOne({email: email});
    }catch(err){
        return next(new HttpError('Could not login, please try again later', 500));
    }

    if(!identifiedUser){
        return next(new HttpError('Could not identify user, credentials seem to be wrong', 403));
    }

    let isPasswordValid = false;
    try{
        isPasswordValid = await bcrypt.compare(password, identifiedUser.password);
    }catch(err){
        return next(new HttpError('Could not login, please try again later', 500));
    }

    if(!isPasswordValid){
        return next(new HttpError('Could not identify user, credentials seem to be wrong', 403));
    }

    let token;
    try{
        token = jwt.sign({userId: identifiedUser.id, email: identifiedUser.email}, process.env.JWT_KEY, {expiresIn: '1h'});
    }catch(err){
        return next(new HttpError('Could not login, please try again later', 500));
    }

    res.status(200).json({userId: identifiedUser.id, email: identifiedUser.email, token: token});
}