const express = require('express');
const {
    getExercises,
    getExerciseOptions,
    getExerciseById,
    getPreviousSets,
    createExercise,
    editExercise,
    removeExercise,
} = require('../controllers/exercise.controller');
const {
    validateCreateExercise,
    validateUpdateExercise,
    validateExerciseId,
    validateListQuery,
    validatePreviousSetsQuery,
} = require('../middlewares/validateExercise');
const { authenticate } = require('../middlewares/auth.middleware');

const exerciseRouter = express.Router();

exerciseRouter.use(authenticate);

exerciseRouter.get('/', validateListQuery, getExercises);
exerciseRouter.get('/options', getExerciseOptions); // must stay above /:id
exerciseRouter.get('/previous-sets', validatePreviousSetsQuery, getPreviousSets); // must stay above /:id
exerciseRouter.get('/:id', validateExerciseId, getExerciseById);
exerciseRouter.post('/', validateCreateExercise, createExercise);
exerciseRouter.put('/:id', validateExerciseId, validateUpdateExercise, editExercise);
exerciseRouter.delete('/:id', validateExerciseId, removeExercise);

module.exports = exerciseRouter;
