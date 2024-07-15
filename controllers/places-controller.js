// const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const { validationResult } = require('express-validator');
const mongoose = require('mongoose');

const HttpError = require('../models/http-error');
const getCoordsForAddress = require('../util/location');
const Place = require('../models/place-model');
const User = require('../models/user-model');
 
exports.getPlaceById = async function (req, res, next) {
  const placeId = req.params.pid;
  let place;
  try {
    place = await Place.findById(placeId).exec();
  } catch (err) {
    return next(
      new HttpError('Something went wrong, could not find place', 500)
    );
  }

  if (!place) {
    return next(new HttpError('Could not find place with given id', 404));
  }
  res.json({ place: place.toObject({ getters: true }) });
};

exports.getPlacesByUserId = async function (req, res, next) {
  const userId = req.params.uid;
  let places;
  try{
    places = await Place.find({creator: userId}).exec();
  }catch(err){
    return next(new HttpError('Something went wrong,Could not find place',500));
  }

  if (!places || places.length === 0) {
    return next(new HttpError('Could not find place with given user id', 404));
  }
  res.json({ places: places.map(p => p.toObject({getters: true})) });
};

exports.createPlace = async function (req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log(errors);
    return next(new HttpError('Invalid inputs passed, please check your data', 422));
  }

  const { title, description, address } = req.body;
  let coordinates;
  try {
    coordinates = await getCoordsForAddress(address);
  } catch (error) {
    return next(error);
  }

  const createdPlace = new Place({
    title,
    description,
    address,
    location: coordinates,
    image:
      req.file.path,
    creator: req.userData.userId,
  });

  let user;
  try{
    user = await User.findById(req.userData.userId);
  }catch(err){
    return next(new HttpError('Could not create place, please try again', 500));
  }

  if(!user){
    return next(new HttpError('Could not find user with given id, place not created', 422));
  }

  try {
    const sess = await mongoose.startSession();
    sess.startTransaction();
    await createdPlace.save({session: sess});
    user.places.push(createdPlace);
    await user.save({session: sess});
    await sess.commitTransaction();
  } catch (err) {
    return next(
      new HttpError('Could not create place, please try again.', 500)
    );
  }
  res.status(201).json({ place: createdPlace });
};

exports.updatePlace = async function (req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log(errors);
    return next(new HttpError('Invalid inputs passed, please check your data', 422));
  }
  const { title, description } = req.body;
  const placeId = req.params.pid;
  let updatedPlace;
  try{
    updatedPlace = await Place.findById(placeId).exec();
  }catch(err){
    return next(new HttpError('Something went wrong, could not find place', 500));
  }

  if(updatedPlace.creator.toString() !== req.userData.userId){
    return next(new HttpError('You are not allowed to edit this place', 401));
  }

  updatedPlace.title = title;
  updatedPlace.description = description;
 
  try{
    await updatedPlace.save();
  }catch(err){
    return next(new HttpError('Something went wrong, could not update place', 500));
  }

  res.status(200).json({ updatedPlace: updatedPlace.toObject({getters: true}) });
};

exports.deletePlace = async function (req, res, next) {
  const placeId = req.params.pid;
  let place;
  try{
    place = await Place.findById(placeId).populate('creator');
  }catch(err){
    return next(new HttpError('Something went wrong, could not delete place', 500));
  }

  if(!place){
    return next(new HttpError('Could not find place for the given id', 404));
  }

  if(place.creator.id !== req.userData.userId){
    return next(new HttpError('You are not allowed to delete this place', 401));
  }

  const placeImage = place.image;

  try{
    const sess = await mongoose.startSession();
    sess.startTransaction();
    await place.deleteOne({session: sess});
    place.creator.places.pull(place);
    await place.creator.save({session: sess});
    await sess.commitTransaction();
  }catch(err){
    return next(new HttpError('Something went wrong, could not delete place', 500));
  }

  fs.unlink(placeImage,(err) => {
    console.log(err);
  })

  res.json({ message: 'place deleted' });
};
