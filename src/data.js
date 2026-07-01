export const services = [
  {
    id: 'basic',
    name: 'Haircut Basic',
    description: 'Potong rambut standar',
    duration: 25,
    price: 25000,
    icon: '✂',
  },
  {
    id: 'beard',
    name: 'Haircut + Beard Trim',
    description: 'Potong rambut dan rapikan janggut',
    duration: 40,
    price: 40000,
    icon: '♢',
  },
  {
    id: 'premium',
    name: 'Premium Grooming',
    description: 'Haircut, wash, styling, dan treatment',
    duration: 55,
    price: 65000,
    icon: '✦',
  },
]

export const barbers = [
  { id: 'budi', name: 'Budi', specialty: 'Senior Barber', rating: 4.9, shift: '08:00 – 16:00', initial: 'B' },
  { id: 'rama', name: 'Rama', specialty: 'Fade Specialist', rating: 4.8, shift: '10:00 – 18:00', initial: 'R' },
  { id: 'fajar', name: 'Fajar', specialty: 'Hair Styling', rating: 4.7, shift: '12:00 – 20:00', initial: 'F' },
]

export const bookingDates = [
  { id: 'today', day: 'Hari ini', date: '25 Jun', full: '25 Juni 2026' },
  { id: 'tomorrow', day: 'Besok', date: '26 Jun', full: '26 Juni 2026' },
  { id: 'later', day: 'Jumat', date: '27 Jun', full: '27 Juni 2026' },
]

export const bookingTimes = ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00']

export const initialQueues = [
  { number: 'A-05', name: 'Nanda', service: 'Haircut Basic', barber: 'Budi', time: '09:20', score: 0.92, status: 'Selesai' },
  { number: 'A-06', name: 'Dimas', service: 'Haircut + Beard', barber: 'Budi', time: '09:40', score: 0.88, status: 'Proses' },
  { number: 'A-07', name: 'Andry', service: 'Haircut Basic', barber: 'Budi', time: '10:00', score: 0.86, status: 'Giliran Anda' },
  { number: 'A-08', name: 'Risaldi', service: 'Haircut + Beard', barber: 'Rama', time: '10:40', score: 0.78, status: 'Menunggu' },
  { number: 'A-09', name: 'Fahri', service: 'Premium Grooming', barber: 'Fajar', time: '11:20', score: 0.72, status: 'Menunggu' },
  { number: 'A-10', name: 'Akbar', service: 'Haircut Basic', barber: 'Rama', time: '12:00', score: 0.61, status: 'Menunggu' },
]

export const historyItems = [
  { date: '25 Jun 2026', service: 'Haircut Basic', barber: 'Budi', status: 'Selesai', price: 25000 },
  { date: '18 Jun 2026', service: 'Premium Grooming', barber: 'Rama', status: 'Selesai', price: 65000 },
  { date: '12 Jun 2026', service: 'Haircut + Beard Trim', barber: 'Fajar', status: 'No-show', price: 40000 },
]

export const formatCurrency = (amount) => `Rp${amount.toLocaleString('id-ID')}`
