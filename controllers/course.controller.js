import fs from 'fs/promises';
import path from 'path';

import cloudinary from 'cloudinary';

import asyncHandler from '../middlewares/asyncHandler.middleware.js';
import Course from '../models/course.model.js';
import ApiError from '../utils/apiError.js';


export const getAllCourses = asyncHandler(async (_req, res, next) => {
  
  const courses = await Course.find({}).select('-lectures');

  res.status(200).json({
    success: true,
    message: 'All courses',
    courses,
  });
});

export const createCourse = asyncHandler(async (req, res, next) => {
  const { title, description, category, createdBy } = req.body;

  if (!title || !description || !category || !createdBy) {
    return next(new ApiError('All fields are required', 400));
  }

  const course = await Course.create({
    title,
    description,
    category,
    createdBy,
  });

  if (!course) {
    return next(
      new ApiError('Course could not be created, please try again', 400)
    );
  }

  
  if (req.file) {
    try {
      const result = await cloudinary.v2.uploader.upload(req.file.path, {
        folder: 'lms', 
      });

      
      if (result) {
       
        course.thumbnail.public_id = result.public_id;
        course.thumbnail.secure_url = result.secure_url;
      }

      fs.rm(`uploads/${req.file.filename}`);
    } catch (error) {
      for (const file of await fs.readdir('uploads/')) {
        await fs.unlink(path.join('uploads/', file));
      }

      
      return next(
        new ApiError(
          JSON.stringify(error) || 'File not uploaded, please try again',
          400
        )
      );
    }
  }

  
  await course.save();

  res.status(201).json({
    success: true,
    message: 'Course created successfully',
    course,
  });
});


export const getLecturesByCourseId = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const course = await Course.findById(id);

  if (!course) {
    return next(new ApiError('Invalid course id or course not found.', 404));
  }

  res.status(200).json({
    success: true,
    message: 'Course lectures fetched successfully',
    lectures: course.lectures,
  });
});


export const addLectureToCourseById = asyncHandler(async (req, res, next) => {
  const { title, description } = req.body;
  const { id } = req.params;

  let lectureData = {};

  if (!title || !description) {
    return next(new ApiError('Title and Description are required', 400));
  }

  const course = await Course.findById(id);

  if (!course) {
    return next(new ApiError('Invalid course id or course not found.', 400));
  }

  
  if (req.file) {
    try {
      const result = await cloudinary.v2.uploader.upload(req.file.path, {
        folder: 'lms', // Save files in a folder named lms
        chunk_size: 50000000, // 50 mb size
        resource_type: 'video',
      });

      // If success
      if (result) {
        // Set the public_id and secure_url in array
        lectureData.public_id = result.public_id;
        lectureData.secure_url = result.secure_url;
      }

      // After successful upload remove the file from local storage
      fs.rm(`uploads/${req.file.filename}`);
    } catch (error) {
      // Empty the uploads directory without deleting the uploads directory
      for (const file of await fs.readdir('uploads/')) {
        await fs.unlink(path.join('uploads/', file));
      }

      
      return next(
        new ApiError(
          JSON.stringify(error) || 'File not uploaded, please try again',
          400
        )
      );
    }
  }

  course.lectures.push({
    title,
    description,
    lecture: lectureData,
  });

  course.numberOfLectures = course.lectures.length;

  
  await course.save();

  res.status(200).json({
    success: true,
    message: 'Course lecture added successfully',
    course,
  });
});


export const removeLectureFromCourse = asyncHandler(async (req, res, next) => {
  
  const { courseId, lectureId } = req.query;

  console.log(courseId);

  
  if (!courseId) {
    return next(new ApiError('Course ID is required', 400));
  }

  if (!lectureId) {
    return next(new ApiError('Lecture ID is required', 400));
  }

  
  const course = await Course.findById(courseId);

  
  if (!course) {
    return next(new ApiError('Invalid ID or Course does not exist.', 404));
  }

  
  const lectureIndex = course.lectures.findIndex(
    (lecture) => lecture._id.toString() === lectureId.toString()
  );

  // If returned index is -1 then send error as mentioned below
  if (lectureIndex === -1) {
    return next(new ApiError('Lecture does not exist.', 404));
  }

  // Delete the lecture from cloudinary
  await cloudinary.v2.uploader.destroy(
    course.lectures[lectureIndex].lecture.public_id,
    {
      resource_type: 'video',
    }
  );

  // Remove the lecture from the array
  course.lectures.splice(lectureIndex, 1);

  // update the number of lectures based on lectres array length
  course.numberOfLectures = course.lectures.length;

  // Save the course object
  await course.save();

  // Return response
  res.status(200).json({
    success: true,
    message: 'Course lecture removed successfully',
  });
});


export const updateCourseById = asyncHandler(async (req, res, next) => {
  // Extracting the course id from the request params
  const { id } = req.params;

  // Finding the course using the course id
  const course = await Course.findByIdAndUpdate(
    id,
    {
      $set: req.body, // This will only update the fields which are present
    },
    {
      runValidators: true, // This will run the validation checks on the new data
    }
  );

  // If no course found then send the response for the same
  if (!course) {
    return next(new ApiError('Invalid course id or course not found.', 400));
  }

  
  res.status(200).json({
    success: true,
    message: 'Course updated successfully',
  });
});


export const deleteCourseById = asyncHandler(async (req, res, next) => {
  
  const { id } = req.params;

  // Finding the course via the course ID
  const course = await Course.findById(id);

  // If course not find send the message as stated below
  if (!course) {
    return next(new ApiError('Course with given id does not exist.', 404));
  }

  // Remove course
  await course.remove();

  
  res.status(200).json({
    success: true,
    message: 'Course deleted successfully',
  });
});
