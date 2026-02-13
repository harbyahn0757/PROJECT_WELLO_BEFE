import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import EmbeddingPage from './pages/EmbeddingPage';
import SurveyPage from './pages/SurveyPage';
import './App.scss';

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<EmbeddingPage />} />
        <Route path="/backoffice" element={<EmbeddingPage />} />
        <Route path="/backoffice/embedding" element={<EmbeddingPage />} />
        <Route path="/backoffice/survey" element={<SurveyPage />} />
        <Route path="/embedding" element={<EmbeddingPage />} />
      </Routes>
    </Router>
  );
};

export default App;
