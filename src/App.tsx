import { useEffect } from 'react'
import { BrowserRouter, Link, Route, Routes, useLocation } from 'react-router-dom'
import { Page, RequireAuth } from './components/Layout'
import Admin from './pages/Admin'
import Book from './pages/Book'
import BookProduct from './pages/BookProduct'
import Checkout from './pages/Checkout'
import Home from './pages/Home'
import Login from './pages/Login'
import OrderDetail from './pages/OrderDetail'
import Orders from './pages/Orders'
import Resources from './pages/Resources'

function ScrollToTop() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (!hash) window.scrollTo(0, 0)
  }, [pathname, hash])
  return null
}

function NotFound() {
  return (
    <Page>
      <section className="section section--top">
        <div className="container card empty">
          <h3>Page not found</h3>
          <p className="muted">The page you're looking for doesn't exist.</p>
          <Link to="/" className="btn btn-dark">
            Back to home
          </Link>
        </div>
      </section>
    </Page>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/resources" element={<Resources />} />
        <Route path="/book" element={<Book />} />
        <Route path="/book/:product" element={<RequireAuth><BookProduct /></RequireAuth>} />
        <Route path="/checkout/:id" element={<RequireAuth><Checkout /></RequireAuth>} />
        <Route path="/orders" element={<RequireAuth><Orders /></RequireAuth>} />
        <Route path="/orders/:id" element={<RequireAuth><OrderDetail /></RequireAuth>} />
        <Route path="/admin" element={<Admin />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  )
}
