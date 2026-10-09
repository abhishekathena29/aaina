// Editable site content. Everything marked PLACEHOLDER should be replaced before launch.

export const WIG_DOS: { title: string; text: string }[] = [
  { title: 'Wash every 10–14 wears', text: 'Use a sulphate-free shampoo and conditioner made for human-hair wigs, in cool or lukewarm water.' },
  { title: 'Detangle gently, from the ends up', text: 'Use a wide-tooth comb or wig brush, holding the hair above the section you are working on.' },
  { title: 'Air-dry on a wig stand', text: 'Pat dry with a soft towel and let it dry naturally on a stand so it keeps its shape.' },
  { title: 'Store it on a stand or in its box', text: 'Keep it away from direct sunlight, dust and humidity when you are not wearing it.' },
  { title: 'Use a wig cap or liner', text: 'A soft cotton or bamboo liner protects a sensitive scalp and helps the wig sit securely.' },
  { title: 'Use heat protectant before styling', text: 'If you use heat tools on a human-hair wig, keep them on a low setting and always protect first.' },
]

export const WIG_DONTS: { title: string; text: string }[] = [
  { title: "Don't sleep in your wig", text: 'Friction against the pillow causes tangling and matting, and your scalp needs to breathe.' },
  { title: "Don't rub or wring it", text: 'Squeeze water out gently — rubbing or twisting damages the cap and the hair.' },
  { title: "Don't brush it when wet", text: 'Hair is most fragile when wet. Detangle with fingers or a wide-tooth comb only.' },
  { title: "Don't use regular hair products", text: 'Products with alcohol or sulphates dry the hair out. Use wig-specific care products.' },
  { title: "Don't expose it to high heat", text: 'Avoid ovens, open flames, saunas and very hot hair tools — they can singe the hair.' },
  { title: "Don't swim or shower wearing it", text: 'Chlorine, salt water and steam can damage the hair and loosen the fit.' },
]

export interface Video {
  title: string
  description: string
  duration: string
  /** YouTube video id (the part after `v=`). Leave empty to show a "coming soon" card. */
  youtubeId: string
}

// PLACEHOLDER: add your YouTube video ids.
export const VIDEOS: Video[] = [
  { title: 'Putting on your wig', description: 'Step-by-step: positioning the front hairline, adjusting the straps and settling the fit.', duration: '5 min', youtubeId: '' },
  { title: 'Securing with clips, tape or a band', description: 'Choosing the right method for comfort and confidence through the day.', duration: '4 min', youtubeId: '' },
  { title: 'Washing & conditioning', description: 'How to wash a human-hair wig without tangles, and how often to do it.', duration: '7 min', youtubeId: '' },
  { title: 'Detangling and gentle styling', description: 'Brushing technique, low-heat styling and keeping the natural movement.', duration: '6 min', youtubeId: '' },
  { title: 'Overnight storage & travel', description: 'Keeping your wig in shape at home and on the go.', duration: '3 min', youtubeId: '' },
  { title: 'Caring for a sensitive scalp', description: 'Liners, moisturising and comfort tips during treatment.', duration: '5 min', youtubeId: '' },
]

// PLACEHOLDER: replace with real testimonials shared with the person's consent.
export const TESTIMONIALS = [
  {
    quote: 'When I lost my hair during chemo, I stopped recognising myself. Aaina made a wig from my own hair and for the first time in months, I looked in the mirror and smiled.',
    highlight: 'made a wig from my own hair',
    name: 'Ananya R.',
    place: 'Bengaluru',
  },
  {
    quote: 'The consultation felt like talking to a friend. They explained everything gently, and the delivery visit was so personal — they made sure it fit perfectly.',
    highlight: 'felt like talking to a friend',
    name: 'Meera K.',
    place: 'Mumbai',
  },
  {
    quote: 'I bought a ready-made natural wig for my mother. The quality is beautiful and the care videos made it easy for her to manage on her own.',
    highlight: 'the care videos made it easy',
    name: 'Rohit S.',
    place: 'New Delhi',
  },
]

// PLACEHOLDER: replace names and photos with your team.
export const TEAM = [
  { name: 'Dr. Kavya Menon', role: 'Hair & Scalp Consultant', photo: '/images/team-1.jpg' },
  { name: 'Sana Qureshi', role: 'Lead Wig Artisan', photo: '/images/team-2.jpg' },
  { name: 'Arjun Mehta', role: 'Client Care Lead', photo: '/images/team-3.jpg' },
]

export const FAQS = [
  {
    q: 'How long does a custom wig take?',
    a: 'A wig made from your own hair usually takes 3–5 weeks after your haircut. We keep you updated on WhatsApp at every step.',
  },
  {
    q: 'When should I cut my hair?',
    a: 'Ideally before treatment causes significant shedding. Your consultant will help you pick the right time.',
  },
  {
    q: 'I already had a consultation. Do I pay for it again?',
    a: 'No. Choose "Already consulted? Book your wig now" and the ₹499 consultation fee is deducted automatically.',
  },
  {
    q: 'How is my slot confirmed?',
    a: 'Once you pay, our team confirms your slot within 30 minutes and you receive an email and WhatsApp message.',
  },
]
