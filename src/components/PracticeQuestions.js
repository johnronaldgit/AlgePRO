import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import MathJax from 'react-mathjax2';
import { db, auth } from '../firebaseConfig';
import { doc, getDoc, collection, addDoc, updateDoc } from 'firebase/firestore';
import questions from '../practice_questions.json'; // Import questions from the separate file
import FloatingButton from './FloatingButton'; // Import FloatingButton

function PracticeQuestions({ lessonNumber }) {
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [answers, setAnswers] = useState({});
  const [submittedAnswers, setSubmittedAnswers] = useState([]);
  const [isFinished, setIsFinished] = useState(false);
  const [isSubmitEnabled, setIsSubmitEnabled] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [knowledgeLevel, setKnowledgeLevel] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [floatingButtonDisabled, setFloatingButtonDisabled] = useState(true); // State to manage FloatingButton
  const floatingButtonRef = useRef(null); // Reference to FloatingButton
  const [showHelpButton, setShowHelpButton] = useState(true); // State to manage "Ask for Help?" button visibility
  const [currentDifficulty, setCurrentDifficulty] = useState('Beginner'); // Track current difficulty level
  const [loadingDifficulty, setLoadingDifficulty] = useState(false); // State to manage loading difficulty
  const [loadingNextQuestion, setLoadingNextQuestion] = useState(false); // State to manage loading state for next question
  const [showConfirmation, setShowConfirmation] = useState(true); // State to manage the display of confirmation dialog

  const navigate = useNavigate(); // Add useNavigate hook

  const fetchKnowledgeLevel = useCallback(async () => {
    const user = auth.currentUser;
    if (user) {
      const userEmail = user.email;
      const lesson = `lesson${lessonNumber}`;
      const scoresRef = doc(db, 'users', userEmail, 'scores', lesson);

      try {
        const scoresDoc = await getDoc(scoresRef);
        if (scoresDoc.exists()) {
          setKnowledgeLevel(scoresDoc.data().knowledgeLevel);
          setCurrentDifficulty(scoresDoc.data().knowledgeLevel); // Set currentDifficulty to knowledgeLevel initially
        }
      } catch (error) {
        console.error('Error fetching knowledge level:', error);
      } finally {
        setIsLoading(false);
      }
    }
  }, [lessonNumber]);

  useEffect(() => {
    fetchKnowledgeLevel();
  }, [fetchKnowledgeLevel]);

  const initializeQuestions = useCallback(() => {
    if (knowledgeLevel) {
      const selectedQuestions = [
        ...questions[`lesson${lessonNumber}`].beginner.map(q => ({ ...q, difficulty: 'Beginner' })),
        ...questions[`lesson${lessonNumber}`].intermediate.map(q => ({ ...q, difficulty: 'Intermediate' })),
        ...questions[`lesson${lessonNumber}`].advanced.map(q => ({ ...q, difficulty: 'Advanced' })),
      ];
      shuffleArray(selectedQuestions);
      const firstQuestion = selectedQuestions.find(q => q.difficulty === knowledgeLevel) || selectedQuestions[0];
      setCurrentQuestion(firstQuestion);
    }
  }, [knowledgeLevel, lessonNumber]);

  useEffect(() => {
    if (knowledgeLevel) {
      initializeQuestions();
    }
  }, [knowledgeLevel, initializeQuestions]);

  const shuffleArray = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  };

  const handleAnswerSelect = (option) => {
    setAnswers((prevAnswers) => ({
      ...prevAnswers,
      [currentQuestion.question]: option,
    }));
    setIsSubmitEnabled(true);
  };

  const handleSubmitAnswer = async () => {
    const isCorrect = answers[currentQuestion.question]?.trim() === currentQuestion.correctAnswer.trim();
    setSubmittedAnswers((prevSubmitted) => [
      ...prevSubmitted,
      { question: currentQuestion, answer: answers[currentQuestion.question], isCorrect },
    ]);
    setIsSubmitted(true);
    if (!isCorrect) {
      setFloatingButtonDisabled(false); // Enable FloatingButton if the answer is incorrect
      setShowHelpButton(true); // Show "Ask for Help?" button
    } else {
      setCorrectCount((prevCount) => prevCount + 1);
      setShowHelpButton(false); // Hide "Ask for Help?" button if the answer is correct
    }

    await updateAndFetchDifficulty(isCorrect);
  };

  const handleNextQuestion = async () => {
    setLoadingNextQuestion(true); // Start loading state for next question

    const latestDifficulty = await fetchCurrentDifficultyContinuously(6); // Fetch the currentDifficulty continuously for 6 seconds
    setCurrentDifficulty(latestDifficulty);

    // Wait for an additional 6 seconds to ensure the correct question is fetched based on the latest currentDifficulty
    await new Promise(resolve => setTimeout(resolve, 6000));

    const selectedQuestions = [
      ...questions[`lesson${lessonNumber}`].beginner.map(q => ({ ...q, difficulty: 'Beginner' })),
      ...questions[`lesson${lessonNumber}`].intermediate.map(q => ({ ...q, difficulty: 'Intermediate' })),
      ...questions[`lesson${lessonNumber}`].advanced.map(q => ({ ...q, difficulty: 'Advanced' })),
    ];

    const newQuestion = selectedQuestions.find(q => q.difficulty === latestDifficulty);
    shuffleArray(selectedQuestions);

    if (!newQuestion || submittedAnswers.length >= 4) {
      await saveDifficultyToFirebase(currentDifficulty, 'Completed'); // Save the practice state as 'Completed'
      setIsFinished(true);
      setLoadingNextQuestion(false); // Stop loading state when finished
      return;
    }

    setCurrentQuestion(newQuestion);
    setIsSubmitted(false);
    setIsSubmitEnabled(false);
    setFloatingButtonDisabled(true); // Disable FloatingButton when moving to the next question
    setLoadingNextQuestion(false); // Stop loading state after fetching current difficulty
  };

  const updateAndFetchDifficulty = async (isCorrect) => {
    adjustDifficulty(isCorrect);
    await fetchCurrentDifficultyFromFirebase();
  };

  const adjustDifficulty = (isCorrect) => {
    let newDifficulty = currentDifficulty;
    if (isCorrect) {
      switch (currentDifficulty) {
        case 'Intermediate':
          newDifficulty = 'Advanced';
          break;
        case 'Beginner':
          newDifficulty = 'Intermediate';
          break;
      }
    } else {
      switch (currentDifficulty) {
        case 'Advanced':
          newDifficulty = 'Intermediate';
          break;
        case 'Intermediate':
          newDifficulty = 'Beginner';
          break;
      }
    }
    setCurrentDifficulty(newDifficulty);
    saveDifficultyToFirebase(newDifficulty); // Save the new difficulty to Firebase
  };

  // Function to save the currentDifficulty and practiceState to Firebase
  const saveDifficultyToFirebase = async (newDifficulty, practiceState = null) => {
    const user = auth.currentUser;
    if (user) {
      const userEmail = user.email;
      const lesson = `lesson${lessonNumber}`;
      const scoresRef = doc(db, 'users', userEmail, 'scores', lesson);

      try {
        const updateData = {
          currentDifficulty: newDifficulty,
        };

        if (practiceState) {
          updateData.practiceState = practiceState;
        }

        await updateDoc(scoresRef, updateData);
      } catch (error) {
        console.error('Error saving data to Firebase:', error);
      }
    }
  };

  // Function to fetch the currentDifficulty from Firebase continuously for 6 seconds
  const fetchCurrentDifficultyContinuously = async (duration) => {
    const endTime = Date.now() + duration * 1000;
    let latestDifficulty = currentDifficulty;

    while (Date.now() < endTime) {
      const difficulty = await fetchCurrentDifficultyFromFirebase();
      if (difficulty) {
        latestDifficulty = difficulty;
      }
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for 1 second
    }

    return latestDifficulty;
  };

  // Function to fetch the currentDifficulty from Firebase
  const fetchCurrentDifficultyFromFirebase = async () => {
    const user = auth.currentUser;
    if (user) {
      const userEmail = user.email;
      const lesson = `lesson${lessonNumber}`;
      const scoresRef = doc(db, 'users', userEmail, 'scores', lesson);

      try {
        const scoresDoc = await getDoc(scoresRef);
        if (scoresDoc.exists()) {
          const fetchedDifficulty = scoresDoc.data().currentDifficulty;
          setCurrentDifficulty(fetchedDifficulty);
          return fetchedDifficulty;
        }
      } catch (error) {
        console.error('Error fetching current difficulty:', error);
      }
    }
    return null;
  };

  const handleAskForHelp = async () => {
    if (floatingButtonRef.current) {
      floatingButtonRef.current.toggleWindow();
      setShowHelpButton(false); // Hide "Ask for Help?" button after clicking it

      const helpMessage = `I need help with the following question: ${currentQuestion.question}`;
      const user = auth.currentUser;
      if (!user) return;

      const userRef = collection(db, 'users', user.email, 'messages');

      // Save the help message to Firebase
      await addDoc(userRef, {
        role: 'user',
        content: helpMessage,
        timestamp: new Date(),
      });

      // Send the help message to the backend
      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ messages: [{ role: 'user', content: helpMessage }] }),
        });

        if (!response.ok) {
          throw new Error(`Network response was not ok: ${response.statusText}`);
        }

        const data = await response.json();
        const responseMessage = { role: 'assistant', content: data.message };

        // Save the assistant's response to Firebase
        await addDoc(userRef, {
          role: 'assistant',
          content: responseMessage.content,
          timestamp: new Date(),
        });

        // Update the messages in the FloatingWindow
        if (floatingButtonRef.current) {
          floatingButtonRef.current.addMessage(responseMessage);
        }

      } catch (error) {
        console.error('Error:', error);
        const errorMessage = { role: 'assistant', content: 'Sorry, something went wrong. Please try again later.' };

        await addDoc(userRef, {
          role: 'assistant',
          content: errorMessage.content,
          timestamp: new Date(),
        });

        // Update the messages in the FloatingWindow
        if (floatingButtonRef.current) {
          floatingButtonRef.current.addMessage(errorMessage);
        }
      }
    }
  };

  const handlePostTestClick = () => {
    navigate(`/lesson/${lessonNumber}/post-test`);
  };

  const renderQuestion = () => {
    if (!currentQuestion) return null;

    const question = currentQuestion;
    const isCorrect = isSubmitted && answers[question.question]?.trim() === question.correctAnswer.trim();

    return (
      <MathJax.Context input="tex">
        <div>
          <div className="text-left mb-4">
            <span className="font-bold">Difficulty:</span> 
            <span style={{ color: '#D7A700', fontWeight: 'bold' }}>
              {question.difficulty}
            </span>
          </div>
          <h2 className="text-2xl font-bold">
            <MathJax.Text text={question.question} />
          </h2>
          <ul className="mt-4">
            {question.options.map((option, index) => (
              <li key={index} className="mb-2">
                <button
                  onClick={() => handleAnswerSelect(option)}
                  className={`block w-full px-4 py-2 text-left border rounded-md ${
                    answers[question.question] === option ? 'bg-blue-500 text-white' : 'bg-white text-black'
                  }`}
                  disabled={isSubmitted}
                >
                  <MathJax.Text text={option} />
                </button>
              </li>
            ))}
          </ul>
          {isSubmitted && (
            <div
              className={`mt-4 p-4 rounded-md ${
                isCorrect ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'
              }`}
            >
              {isCorrect ? 'Correct!' : `Incorrect! The correct answer is `}
              <MathJax.Text text={question.correctAnswer} />
            </div>
          )}
          <div className="mt-6 flex justify-end items-center">
            {isSubmitted && !isCorrect && showHelpButton && (
              <button
                onClick={handleAskForHelp}
                className="mr-4 p-2 bg-yellow-500 text-white rounded-md"
              >
                Ask for Help?
              </button>
            )}
            <button
              onClick={isSubmitted ? handleNextQuestion : handleSubmitAnswer}
              className={`px-4 py-2 rounded-md ${
                isSubmitEnabled || isSubmitted
                  ? 'bg-blue-500 text-white hover:bg-blue-600'
                  : 'bg-red-500 text-white cursor-not-allowed'
              }`}
              disabled={!isSubmitEnabled && !isSubmitted}
            >
              {isSubmitted ? 'Next' : 'Submit'}
            </button>
          </div>
        </div>
      </MathJax.Context>
    );
  };

  const renderResults = () => {
    return (
      <MathJax.Context input="tex">
        <div>
          <h2 className="text-2xl font-bold">Practice Completed</h2>
          <p className="mt-4">
            You have finished the practice questions for Lesson {lessonNumber}.
          </p>
          <div className="mt-6">
            <h3 className="text-xl font-bold">Review Your Answers</h3>
            <ul className="mt-4">
              {submittedAnswers.map((answer, index) => (
                <li key={index} className="mb-4">
                  <div className="flex items-center">
                    <span className="mr-2">{index + 1}.</span>
                    <MathJax.Text text={answer.question.question} />
                  </div>
                  <div
                    className={`mt-2 p-2 rounded-md ${
                      answer.isCorrect ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'
                    }`}
                  >
                    Your answer: <MathJax.Text text={answer.answer} /> -{' '}
                    {answer.isCorrect ? 'Correct' : `Incorrect, the correct answer is `}
                    <MathJax.Text text={answer.question.correctAnswer} />
                  </div>
                </li>
              ))}
            </ul>
            <div className="flex justify-end mt-4">
              <button
                onClick={handlePostTestClick}
                className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-700"
              >
                Take Post-Test
              </button>
            </div>
          </div>
        </div>
      </MathJax.Context>
    );
  };

  if (isLoading || loadingDifficulty || loadingNextQuestion) {
    return (
      <div className="bg-blue-200 p-6 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold">Loading...</h2>
      </div>
    );
  }

  if (!knowledgeLevel) {
    return (
      <div className="bg-blue-200 p-6 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold">No Knowledge Level Found</h2>
      </div>
    );
  }

  if (showConfirmation) {
    return (
      <div className="bg-blue-200 p-6 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold">Practice Questions Confirmation</h2>
        <p className="mt-4">Do you want to start the practice questions for Lesson {lessonNumber}?</p>
        <div className="mt-6 flex justify-between">
          <button
            onClick={() => setShowConfirmation(false)}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
          >
            Yes, start practice questions
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
        <h1 className="text-3xl font-bold text-darkblue">
          Lesson {lessonNumber} - Practice Questions
        </h1>
        <div className="text-lg font-semibold">
          Correct: {correctCount} / 5
        </div>
      </header>
      <section className="mt-6">
        <div className="bg-blue-200 p-6 rounded-lg shadow-md">
          {!isFinished ? (
            <>
              {renderQuestion()}
            </>
          ) : (
            renderResults()
          )}
        </div>
      </section>
      <FloatingButton ref={floatingButtonRef} disabled={floatingButtonDisabled} />
    </div>
  );
}

export default PracticeQuestions;
