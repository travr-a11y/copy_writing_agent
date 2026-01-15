import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import CampaignList from './pages/CampaignList'
import CampaignDetail from './pages/CampaignDetail'
import CampaignCreate from './pages/CampaignCreate'

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<CampaignList />} />
        <Route path="/campaigns/new" element={<CampaignCreate />} />
        <Route path="/campaigns/:id" element={<CampaignDetail />} />
      </Routes>
    </Layout>
  )
}

export default App
