import React, { useState, useEffect } from 'react';
import MathJax from 'react-mathjax2';
import { db, auth } from '../firebaseConfig';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useNavigate, useOutletContext } from 'react-router-dom';
import postQuestions from '../postQuestions'; // Import post-test questions from the separate file

function PostTest({ lessonNumber }) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [submittedAnswers, setSubmittedAnswers] = useState([]);
  const [isFinished, setIsFinished] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [incorrectCount, setIncorrectCount] = useState(0);
  const [isSubmitEnabled, setIsSubmitEnabled] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(true);
  const [hasCompletedPostTest, setHasCompletedPostTest] = useState(false);
  const [completedTestData, setCompletedTestData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [didPass, setDidPass] = useState(null); // Updated state for passing status
  const [saving, setSaving] = useState(false); // Loading state for saving results
  const [attempts, setAttempts] = useState(0); // State to track the number of attempts

  const navigate = useNavigate();
  const { setLoading, fetchUnlockedLessons } = useOutletContext(); // Get setLoading and fetchUnlockedLessons from context

  useEffect(() => {
    const fetchData = async () => {
      const user = auth.currentUser;
      if (user) {
        const userEmail = user.email;
        const lesson = `lesson${lessonNumber}`;
        const postTestDocRef = doc(db, 'users', userEmail, 'scores', lesson);

        const postTestDoc = await getDoc(postTestDocRef);
        if (postTestDoc.exists() && postTestDoc.data().post_test_score !== undefined) {
          const data = postTestDoc.data();
          setHasCompletedPostTest(true);
          setCompletedTestData(data.post_test_score);
          setDidPass(data.didPass);
          setAttempts(data.attempts || 0); // Set attempts from fetched data
          if (!data.didPass) {
            setIsFinished(true); // Set isFinished to true if the user failed the test
          }
          // Set correct and incorrect counts from fetched data
          setCorrectCount(data.post_test_score);
          setIncorrectCount(5 - data.post_test_score);
        } else {
          setHasCompletedPostTest(false);
          setCompletedTestData(null);
        }
      }
      setIsLoading(false);
    };

    // Reset state when lessonNumber changes
    setIsLoading(true);
    setCurrentQuestionIndex(0);
    setAnswers([]);
    setSubmittedAnswers([]);
    setIsFinished(false);
    setCorrectCount(0);
    setIncorrectCount(0);
    setIsSubmitEnabled(false);
    setIsSubmitted(false);
    setShowConfirmation(true);
    setDidPass(null);
    fetchData();
  }, [lessonNumber]);

  const lessonQuestions = postQuestions[`lesson${lessonNumber}`].slice(0, 5); // Ensure only 5 questions are used

  const handleAnswerSelect = (option) => {
    const newAnswers = [...answers];
    newAnswers[currentQuestionIndex] = option;
    setAnswers(newAnswers);
    setIsSubmitEnabled(true);
  };

  const handleSubmitAnswer = () => {
    const newSubmittedAnswers = [...submittedAnswers];
    newSubmittedAnswers[currentQuestionIndex] = {
      answer: answers[currentQuestionIndex],
      isCorrect: answers[currentQuestionIndex]?.trim() === lessonQuestions[currentQuestionIndex].correctAnswer.trim()
    };
    setSubmittedAnswers(newSubmittedAnswers);
    setIsSubmitted(true);
    calculateResults(newSubmittedAnswers);
  };

  const handleNextQuestion = () => {
    setIsSubmitted(false);
    setIsSubmitEnabled(false);
    if (currentQuestionIndex < lessonQuestions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      // Check if user passed or failed the test
      const passed = correctCount >= 4;
      setDidPass(passed);
      saveScore(passed, correctCount);
      setIsFinished(true);
    }
  };

  const calculateResults = (submittedAnswers) => {
    let correct = 0;
    let incorrect = 0;
    submittedAnswers.forEach((answer) => {
      if (answer.isCorrect) {
        correct++;
      } else {
        incorrect++;
      }
    });
    setCorrectCount(correct);
    setIncorrectCount(incorrect);
  };

  const determineKnowledgeLevel = (score) => {
    if (score >= 0 && score <= 1) {
      return 'Beginner';
    } else if (score >= 2 && score <= 3) {
      return 'Intermediate';
    } else if (score >= 4 && score <= 5) {
      return 'Advanced';
    }
    return null;
  };

  const saveScore = async (passed, score) => {
    const user = auth.currentUser;
    if (user) {
      const userEmail = user.email;
      const lesson = `lesson${lessonNumber}`;
      const scoresRef = doc(db, 'users', userEmail, 'scores', lesson);
      const knowledgeLevel = determineKnowledgeLevel(score);

      try {
        setSaving(true);
        const postTestDoc = await getDoc(scoresRef);
        const newAttempts = (postTestDoc.exists() && postTestDoc.data().attempts ? postTestDoc.data().attempts : 0) + 1; // Increment attempts
        await setDoc(scoresRef, {
          post_test_score: score,
          didPass: passed, // Save pass/fail status
          knowledgeLevel: knowledgeLevel, // Save knowledge level
          attempts: newAttempts // Save the number of attempts
        }, { merge: true });

        console.log('Post-test score saved successfully');

        setAttempts(newAttempts); // Update the state with the new attempts count

        // Unlock the next lesson if passed
        if (passed) {
          const userDocRef = doc(db, 'users', userEmail);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            const unlockedLessons = userData.unlockedLessons || [1];
            const nextLessonNumber = parseInt(lessonNumber) + 1;
            if (!unlockedLessons.includes(nextLessonNumber)) {
              unlockedLessons.push(nextLessonNumber);
              await setDoc(userDocRef, { unlockedLessons }, { merge: true });
            }
          }
        }

        // Trigger loading state and fetch unlocked lessons after saving score
        setLoading(true);
        await fetchUnlockedLessons(userEmail);
        setLoading(false);
      } catch (error) {
        console.error('Error saving post-test score:', error);
      } finally {
        setSaving(false);
        setHasCompletedPostTest(true);
        setCompletedTestData(score);
      }
    }
  };

  const handleRetakeTest = () => {
    setDidPass(null); // Reset pass status
    setIsFinished(false); // Allow retaking the post-test
    setCurrentQuestionIndex(0); // Restart the test
    setShowConfirmation(true); // Show confirmation again before retaking the test
    setAnswers([]); // Reset answers
    setSubmittedAnswers([]); // Reset submitted answers
  };

  const renderQuestion = () => {
    const question = lessonQuestions[currentQuestionIndex];
    const isCorrect = isSubmitted && answers[currentQuestionIndex]?.trim() === question.correctAnswer.trim();

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
            <div className={`mt-4 p-4 rounded-md ${isCorrect ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>
              {isCorrect ? 'Correct!' : 'Incorrect!'}
            </div>
          )}
        </div>
      </MathJax.Context>
    );
  };

  const renderResults = (score) => {
    return (
      <div>
        <h2 className="text-2xl font-bold">Test Completed</h2>
        <p className="mt-4">Total Score: {score} out of 5</p>
        <p className="mt-2">Number of Attempts: {attempts}</p> {/* Display number of attempts */}
      </div>
    );
  };

  if (isLoading || saving) {
    return (
      <div className="bg-blue-200 p-6 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold">{saving ? 'Saving Results...' : 'Loading...'}</h2>
      </div>
    );
  }

  if (isFinished && didPass === false) {
    return (
      <div className="bg-red-200 p-6 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold">Post-test Not Passed</h2>
        <p className="mt-4">You did not pass the post-test for Lesson {lessonNumber}.</p>
        <p className="mt-2">Total Score: {correctCount} out of 5</p>
        <p className="mt-2">You need to score at least 4 out of 5 to pass.</p>
        <div className="mt-6 flex justify-between">
          <button
            onClick={() => navigate(`/lesson/${lessonNumber}/subtopic/1`)}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
          >
            Review Lesson
          </button>
          <button
            onClick={() => navigate(`/lesson/${lessonNumber}/practice`)}
            className="px-4 py-2 bg-yellow-500 text-black rounded-md hover:bg-yellow-600"
          >
            Practice Questions
          </button>
          <button
            onClick={handleRetakeTest}
            className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
          >
            Take Post-Test Again
          </button>
        </div>
      </div>
    );
  }

  if (hasCompletedPostTest && didPass) {
    return (
      <div className="bg-blue-200 p-6 rounded-lg shadow-md">
        {renderResults(completedTestData)}
        <div className="mt-6 flex justify-between">
          <button
            onClick={() => navigate('/dashboard')}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
          >
            Go to Dashboard
          </button>
          {parseInt(lessonNumber) < 5 && (
            <button
              onClick={() => navigate(`/lesson/${parseInt(lessonNumber) + 1}/pre-test`)}
              className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
            >
              Next Lesson
            </button>
          )}
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
        <h2 className="text-2xl font-bold">Post-test Confirmation</h2>
        <p className="mt-4">Do you want to take the post-test for Lesson {lessonNumber}?</p>
        <div className="mt-6 flex justify-between">
          <button
            onClick={() => setShowConfirmation(false)}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
          >
            Yes, take the post-test
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
        <h1 className="text-3xl font-bold text-darkblue">Lesson {lessonNumber} - Post-test</h1>
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
            renderResults(correctCount)
          )}
        </div>
      </section>
    </div>
  );
}

export default PostTest;
