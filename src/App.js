import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Home from './components/Home';
import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './components/Dashboard';
import Lesson from './components/Lesson';
import Subtopic from './components/Subtopic';
import PreTest from './components/PreTest';
import PostTest from './components/PostTest';
import Layout from './components/Layout';
import PracticeQuestions from './components/PracticeQuestions';
import About from './components/About'; // Import the About component
import Help from './components/Help'; // Import the Help component
import Profile from './components/Profile'; // Import the Profile component

const lessons = [
  {
    number: '1',
    subtopics: ['Square of Binomials'],
  },
  {
    number: '2',
    subtopics: ['Square of Trinomial'],
  },
  {
    number: '3',
    subtopics: ['The Product of a Sum and Difference of the Same Two Terms'],
  },
  {
    number: '4',
    subtopics: ['Cube of Binomials'],
  },
  {
    number: '5',
    subtopics: ['Special Case on the Product of Binomial and Trinomial'],
  },
];

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/about" element={<About />} /> {/* Add the About route */}
          <Route path="/help" element={<Help />} /> {/* Add the Help route */}
          <Route path="/profile" element={<Profile />} /> {/* Add the Profile route */}
          {lessons.map((lesson) => (
            <Route
              key={lesson.number}
              path={`/lesson/${lesson.number}`}
              element={<Lesson lessonNumber={lesson.number} />}
            />
          ))}
          <Route path="/lesson/6-7" element={<Lesson lessonNumber="6-7" />} />
          <Route path="/lesson/8-9" element={<Lesson lessonNumber="8-9" />} />
          {lessons.map((lesson, lessonIndex) =>
            lesson.subtopics.map((subtopic, subIndex) => (
              <React.Fragment key={`${lessonIndex}-${subIndex}`}>
                <Route
                  path={`/lesson/${lesson.number}/subtopic/${subIndex + 1}`}
                  element={<Subtopic lessonNumber={lesson.number} subtopic={subtopic} />}
                />
              </React.Fragment>
            ))
          )}
          {lessons.map((lesson) => (
            <React.Fragment key={`tests-${lesson.number}`}>
              <Route
                key={`pre-${lesson.number}`}
                path={`/lesson/${lesson.number}/pre-test`}
                element={<PreTest lessonNumber={lesson.number} />}
              />
              <Route
                key={`post-${lesson.number}`}
                path={`/lesson/${lesson.number}/post-test`}
                element={<PostTest lessonNumber={lesson.number} />}
              />
              <Route
                key={`practice-${lesson.number}`}
                path={`/lesson/${lesson.number}/practice`}
                element={<PracticeQuestions lessonNumber={lesson.number} />}
              />
            </React.Fragment>
          ))}
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
