import { Routes, Route } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import AdminView from './pages/AdminView'
import VotingView from './pages/VotingView'

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/admin/:sessionId" element={<AdminView />} />
      <Route path="/vote/:sessionId" element={<VotingView />} />
    </Routes>
  )
}

export default App
