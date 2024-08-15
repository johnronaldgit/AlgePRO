import React, { useState, useEffect } from 'react';
import MathJax from 'react-mathjax2';
import { db, auth } from '../firebaseConfig';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import questions from '../questions'; // Import questions from the separate file

function PreTest({ lessonNumber }) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [isFinished, setIsFinished] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [isSubmitEnabled, setIsSubmitEnabled] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(true);
  const [hasCompletedPreTest, setHasCompletedPreTest] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const navigate = useNavigate();

  useEffect(() => {
    const checkPreTestCompletion = async () => {
      const user = auth.currentUser;
      if (user) {
        const userEmail = user.email;
        const lesson = `lesson${lessonNumber}`;
        const preTestDocRef = doc(db, 'users', userEmail, 'scores', lesson);

        const preTestDoc = await getDoc(preTestDocRef);
        if (preTestDoc.exists() && preTestDoc.data().pre_test_scores !== undefined) {
          setHasCompletedPreTest(true);
        } else {
          setHasCompletedPreTest(false);
        }
      }
      setIsLoading(false);
    };

    checkPreTestCompletion();

    // Reset state when lessonNumber changes
    setCurrentQuestionIndex(0);
    setAnswers([]);
    setIsFinished(false);
    setCorrectCount(0);
    setIsSubmitEnabled(false);
    setIsSubmitted(false);
    setShowConfirmation(true);
    setIsLoading(true);
  }, [lessonNumber]);

  const lessonQuestions = questions[`lesson${lessonNumber}`].slice(0, 5); // Change to 5 questions

  const handleAnswerSelect = (option) => {
    const newAnswers = [...answers];
    newAnswers[currentQuestionIndex] = option;
    setAnswers(newAnswers);
    setIsSubmitEnabled(true);
  };

  const handleSubmitAnswer = () => {
    const isCorrect = answers[currentQuestionIndex]?.trim() === lessonQuestions[currentQuestionIndex].correctAnswer.trim();
    setIsSubmitted(true);
    if (isCorrect) {
      setCorrectCount(correctCount + 1);
    }
  };

  const handleNextQuestion = () => {
    setIsSubmitted(false);
    setIsSubmitEnabled(false);
    if (currentQuestionIndex < lessonQuestions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      setIsFinished(true);
      saveScore();
    }
  };

  const saveScore = async () => {
    const user = auth.currentUser;
    if (user) {
      const userEmail = user.email;
      const lesson = `lesson${lessonNumber}`;
      const scoresRef = doc(db, 'users', userEmail, 'scores', lesson);

      try {
        await setDoc(scoresRef, {
          pre_test_scores: correctCount,
          knowledgeLevel: 'Beginner' // Set the knowledge level to Beginner after pre-test
        }, { merge: true });

        console.log('Pre-test score and knowledge level saved successfully');
      } catch (error) {
        console.error('Error saving pre-test score and knowledge level:', error);
      }
    }
  };

  const renderQuestion = () => {
    const question = lessonQuestions[currentQuestionIndex];

    return (
      <MathJax.Context input='tex'>
        <div>
          <h2 className="text-2xl font-bold">
            <MathJax.Text text={question.question} />
          </h2>
          <ul className="mt-4">
            {question.options.map((option, index) => (
              <li key={index} className="mb-2">
                <button
                  onClick={() => handleAnswerSelect(option)}
                  className={`block w-full px-4 py-2 text-left border rounded-md ${
                    answers[currentQuestionIndex] === option ? 'bg-blue-500 text-white' : 'bg-white text-black'
                  }`}
                  disabled={isSubmitted}
                >
                  <MathJax.Text text={option} />
                </button>
              </li>
            ))}
          </ul>
          {isSubmitted && (
            <div className={`mt-4 p-4 rounded-md ${answers[currentQuestionIndex]?.trim() === question.correctAnswer.trim() ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>
              {answers[currentQuestionIndex]?.trim() === question.correctAnswer.trim() ? 'Correct!' : 'Incorrect!'}
            </div>
          )}
        </div>
      </MathJax.Context>
    );
  };

  if (isLoading) {
    return (
      <div className="bg-blue-200 p-6 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold">Loading...</h2>
      </div>
    );
  }

  if (hasCompletedPreTest) {
    return (
      <div className="bg-blue-200 p-6 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold">Pre-Test Completed</h2>
        <p className="mt-4">You have already completed the pre-test for Lesson {lessonNumber}.</p>
        <div className="mt-6 flex justify-between">
          <button
            onClick={() => navigate('/dashboard')}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
          >
            Go to Dashboard
          </button>
          <button
            onClick={() => navigate(`/lesson/${lessonNumber}/subtopic/1`)}
            className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
          >
            Next
          </button>
        </div>
      </div>
    );
  }

  if (!lessonQuestions) {
    return <p>No questions available for this lesson.</p>;
  }

  if (showConfirmation) {
    return (
      <div className="bg-blue-200 p-6 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold">Pre-test Confirmation</h2>
        <p className="mt-4">Do you want to take the pre-test for Lesson {lessonNumber}?</p>
        <div className="mt-6 flex justify-between">
          <button
            onClick={() => setShowConfirmation(false)}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
          >
            Yes, take the pre-test
          </button>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600"
          >
            No, go back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-darkblue">Lesson {lessonNumber} - Pre-test</h1>
      </header>
      <section className="mt-6">
        <div className="bg-blue-200 p-6 rounded-lg shadow-md">
          {!isFinished ? (
            <>
              {renderQuestion()}
              <div className="mt-6 flex justify-end">
                <button
                  onClick={isSubmitted ? handleNextQuestion : handleSubmitAnswer}
                  className={`px-4 py-2 rounded-md ${isSubmitEnabled ? 'bg-blue-500 text-white hover:bg-blue-600' : 'bg-red-500 text-white cursor-not-allowed'}`}
                  disabled={!isSubmitEnabled}
                >
                  {isSubmitted ? (currentQuestionIndex < lessonQuestions.length - 1 ? 'Next' : 'Finish') : 'Submit'}
                </button>
              </div>
            </>
          ) : (
            <div>
              <h2 className="text-2xl font-bold">Test Completed</h2>
              <p className="mt-4">Total Score: {correctCount} out of 5</p>
              <div className="mt-6 flex justify-between">
                <button
                  onClick={() => navigate('/dashboard')}
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                >
                  Go to Dashboard
                </button>
                <button
                  onClick={() => navigate(`/lesson/${lessonNumber}/subtopic/1`)}
                  className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export default PreTest;
