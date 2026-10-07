import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Explore from './pages/Explore'
import Campaign from './pages/Campaign'
import Auth from './pages/Auth'
import Create from './pages/Create'
import Dashboard from './pages/Dashboard'
import How from './pages/How'

export default function App(){
  return <Routes>
    <Route path="/entrar" element={<Auth/>}/>
    <Route element={<Layout/>}>
      <Route path="/" element={<Home/>}/>
      <Route path="/explorar" element={<Explore/>}/>
      <Route path="/campanha/:slug" element={<Campaign/>}/>
      <Route path="/criar" element={<Create/>}/>
      <Route path="/painel" element={<Dashboard/>}/>
      <Route path="/como-funciona" element={<How/>}/>
      <Route path="*" element={<main className="shell page"><div className="empty"><b>404</b><h1>Página não encontrada</h1></div></main>}/>
    </Route>
  </Routes>
}
