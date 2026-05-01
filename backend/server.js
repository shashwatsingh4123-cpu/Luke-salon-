const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json());

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-in-production';

// ─── Middleware ────────────────────────────────────────────────────────────────
const auth = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admins only' });
  next();
};

// ─── Auth Routes ───────────────────────────────────────────────────────────────

// Customer signup
app.post('/api/auth/signup', async (req, res) => {
  const { name, email, password, phone } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Missing fields' });

  const { data: existing } = await supabase.from('users').select('id').eq('email', email).single();
  if (existing) return res.status(400).json({ error: 'Email already registered' });

  const hashed = await bcrypt.hash(password, 10);
  const { data, error } = await supabase.from('users').insert([
    { name, email, password: hashed, phone, role: 'customer' }
  ]).select().single();

  if (error) return res.status(500).json({ error: error.message });

  const token = jwt.sign({ id: data.id, email: data.email, role: 'customer', name: data.name }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: data.id, name: data.name, email: data.email, phone: data.phone, role: 'customer' } });
});

// Login (customers + admin)
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  // Check admin table first
  const { data: admin } = await supabase.from('admins').select('*').eq('email', email).single();
  if (admin) {
    const valid = await bcrypt.compare(password, admin.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: admin.id, email: admin.email, role: 'admin', name: admin.name }, JWT_SECRET, { expiresIn: '7d' });
    return res.json({ token, user: { id: admin.id, name: admin.name, email: admin.email, role: 'admin' } });
  }

  // Check users table
  const { data: user } = await supabase.from('users').select('*').eq('email', email).single();
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign({ id: user.id, email: user.email, role: 'customer', name: user.name }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: 'customer' } });
});

// Get current user
app.get('/api/auth/me', auth, async (req, res) => {
  const table = req.user.role === 'admin' ? 'admins' : 'users';
  const { data } = await supabase.from(table).select('id, name, email, phone, role').eq('id', req.user.id).single();
  res.json(data);
});

// ─── Services Routes ───────────────────────────────────────────────────────────

// Get all services
app.get('/api/services', async (req, res) => {
  const { data, error } = await supabase.from('services').select('*').order('category');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Add a service (admin only)
app.post('/api/services', auth, adminOnly, async (req, res) => {
  const { name, description, price, duration_minutes, category, image_url } = req.body;
  const { data, error } = await supabase.from('services').insert([
    { name, description, price, duration_minutes, category, image_url }
  ]).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Update a service (admin only)
app.put('/api/services/:id', auth, adminOnly, async (req, res) => {
  const { data, error } = await supabase.from('services').update(req.body).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Delete a service (admin only)
app.delete('/api/services/:id', auth, adminOnly, async (req, res) => {
  const { error } = await supabase.from('services').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ─── Bookings Routes ───────────────────────────────────────────────────────────

// Create booking
app.post('/api/bookings', auth, async (req, res) => {
  const { service_ids, date, time_slot, notes } = req.body;
  if (!service_ids?.length || !date || !time_slot) return res.status(400).json({ error: 'Missing fields' });

  // Calculate total price
  const { data: services } = await supabase.from('services').select('id, price').in('id', service_ids);
  const total = services.reduce((sum, s) => sum + parseFloat(s.price), 0);

  const { data: booking, error } = await supabase.from('bookings').insert([{
    user_id: req.user.id,
    date,
    time_slot,
    notes,
    total_price: total,
    status: 'pending'
  }]).select().single();

  if (error) return res.status(500).json({ error: error.message });

  // Insert booking_services join
  const joins = service_ids.map(sid => ({ booking_id: booking.id, service_id: sid }));
  await supabase.from('booking_services').insert(joins);

  res.json(booking);
});

// Get my bookings (customer)
app.get('/api/bookings/my', auth, async (req, res) => {
  const { data, error } = await supabase
    .from('bookings')
    .select('*, booking_services(service_id, services(name, price, category))')
    .eq('user_id', req.user.id)
    .order('date', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Cancel booking (customer)
app.patch('/api/bookings/:id/cancel', auth, async (req, res) => {
  const { data: booking } = await supabase.from('bookings').select('user_id').eq('id', req.params.id).single();
  if (!booking) return res.status(404).json({ error: 'Not found' });
  if (booking.user_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

  const { data, error } = await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ─── Admin Routes ──────────────────────────────────────────────────────────────

// Get all bookings
app.get('/api/admin/bookings', auth, adminOnly, async (req, res) => {
  const { data, error } = await supabase
    .from('bookings')
    .select('*, users(name, email, phone), booking_services(service_id, services(name, price, category))')
    .order('date', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Get all customers
app.get('/api/admin/customers', auth, adminOnly, async (req, res) => {
  const { data, error } = await supabase
    .from('users')
    .select('id, name, email, phone, created_at')
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Update booking status
app.patch('/api/admin/bookings/:id/status', auth, adminOnly, async (req, res) => {
  const { status } = req.body;
  const { data, error } = await supabase.from('bookings').update({ status }).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Dashboard stats
app.get('/api/admin/stats', auth, adminOnly, async (req, res) => {
  const [customers, bookings, services] = await Promise.all([
    supabase.from('users').select('id', { count: 'exact' }),
    supabase.from('bookings').select('id, total_price, status, created_at', { count: 'exact' }),
    supabase.from('services').select('id', { count: 'exact' })
  ]);

  const allBookings = bookings.data || [];
  const revenue = allBookings.filter(b => b.status === 'completed').reduce((s, b) => s + parseFloat(b.total_price || 0), 0);
  const pending = allBookings.filter(b => b.status === 'pending').length;
  const confirmed = allBookings.filter(b => b.status === 'confirmed').length;

  // Bookings per day (last 7 days)
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split('T')[0];
  });
  const bookingsPerDay = last7.map(day => ({
    date: day,
    count: allBookings.filter(b => b.created_at?.startsWith(day)).length
  }));

  res.json({
    totalCustomers: customers.count || 0,
    totalBookings: bookings.count || 0,
    totalServices: services.count || 0,
    totalRevenue: revenue.toFixed(2),
    pendingBookings: pending,
    confirmedBookings: confirmed,
    bookingsPerDay
  });
});

// ─── Reviews ───────────────────────────────────────────────────────────────────

// Get reviews for a service
app.get('/api/services/:id/reviews', async (req, res) => {
  const { data, error } = await supabase
    .from('reviews')
    .select('*, users(name)')
    .eq('service_id', req.params.id)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Add a review
app.post('/api/services/:id/reviews', auth, async (req, res) => {
  const { rating, comment } = req.body;
  const { data, error } = await supabase.from('reviews').insert([{
    service_id: req.params.id,
    user_id: req.user.id,
    rating,
    comment
  }]).select().single();
  if (error) return res.status(500).json({ error: error.message });

  // Update average rating on service
  const { data: reviews } = await supabase.from('reviews').select('rating').eq('service_id', req.params.id);
  const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
  await supabase.from('services').update({ avg_rating: avg.toFixed(1), review_count: reviews.length }).eq('id', req.params.id);

  res.json(data);
});

app.listen(process.env.PORT || 5000, () => console.log(`Server running on port ${process.env.PORT || 5000}`));
