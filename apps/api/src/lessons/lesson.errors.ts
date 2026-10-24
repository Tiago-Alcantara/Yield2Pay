export class LessonNotFoundError extends Error {
  constructor(message = 'Lesson not found') {
    super(message);
    this.name = 'LessonNotFoundError';
  }
}

export class LessonTrackError extends Error {
  constructor(message = 'Invalid lesson track') {
    super(message);
    this.name = 'LessonTrackError';
  }
}

export class LessonQuizError extends Error {
  constructor(message = 'Quiz not passed') {
    super(message);
    this.name = 'LessonQuizError';
  }
}
