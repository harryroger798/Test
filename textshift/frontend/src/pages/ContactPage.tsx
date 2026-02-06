import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Mail, MapPin, Phone, Send, Loader2, CheckCircle, Building } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const API_URL = import.meta.env.VITE_API_URL ?? (import.meta.env.PROD ? '' : 'http://localhost:8000');

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/api/contact/support`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setSuccess(true);
        setFormData({ name: '', email: '', subject: '', message: '' });
      } else {
        const data = await response.json();
        setError(data.detail || 'Failed to send message. Please try again.');
      }
    } catch {
      setError('Failed to send message. Please email us directly at support@textshift.org');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-emerald-500/10 via-emerald-500/5 to-transparent rounded-full blur-3xl" />
      </div>

      <nav className="sticky top-0 z-50 border-b border-white/10 bg-[#0a0a0a]/80 backdrop-blur-lg">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <Link to="/" className="flex items-center gap-2">
              <img src="/images/logo.png" alt="TextShift" className="h-8 w-auto" />
              <span className="text-white font-medium tracking-wide">TextShift</span>
            </Link>
            <Link to="/" className="flex items-center gap-2 text-gray-400 hover:text-white transition">
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-light text-white mb-4">Contact Us</h1>
          <p className="text-gray-400">We'd love to hear from you. Get in touch with our team.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="bg-gradient-to-b from-white/5 to-transparent border border-white/10 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-emerald-500/20 rounded-lg">
                  <Building className="w-5 h-5 text-emerald-400" />
                </div>
                <h2 className="text-xl font-medium text-white">Company Information</h2>
              </div>
              <div className="space-y-4 text-gray-300">
                <p><strong className="text-white">Company Name:</strong> TextShift</p>
                <p><strong className="text-white">Founder:</strong> Sayan Roy Chowdhury</p>
              </div>
            </div>

            <div className="bg-gradient-to-b from-white/5 to-transparent border border-white/10 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <MapPin className="w-5 h-5 text-blue-400" />
                </div>
                <h2 className="text-xl font-medium text-white">Address</h2>
              </div>
              <p className="text-gray-300">
                18/1 Banerjee Para Road<br />
                West Bengal - 700122<br />
                India
              </p>
            </div>

            <div className="bg-gradient-to-b from-white/5 to-transparent border border-white/10 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-purple-500/20 rounded-lg">
                  <Mail className="w-5 h-5 text-purple-400" />
                </div>
                <h2 className="text-xl font-medium text-white">Email</h2>
              </div>
              <div className="space-y-2 text-gray-300">
                <p><strong className="text-white">General Inquiries:</strong> support@textshift.org</p>
                <p><strong className="text-white">Sales:</strong> sales@textshift.org</p>
                <p><strong className="text-white">Technical Support:</strong> help@textshift.org</p>
              </div>
            </div>

            <div className="bg-gradient-to-b from-white/5 to-transparent border border-white/10 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-amber-500/20 rounded-lg">
                  <Phone className="w-5 h-5 text-amber-400" />
                </div>
                <h2 className="text-xl font-medium text-white">Business Hours</h2>
              </div>
              <p className="text-gray-300">
                Monday - Friday: 9:00 AM - 6:00 PM IST<br />
                Saturday: 10:00 AM - 4:00 PM IST<br />
                Sunday: Closed
              </p>
            </div>
          </div>

          <div className="bg-gradient-to-b from-white/5 to-transparent border border-white/10 rounded-2xl p-6">
            <h2 className="text-xl font-medium text-white mb-6">Send us a Message</h2>
            
            {success ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-emerald-400" />
                </div>
                <h3 className="text-lg font-medium text-white mb-2">Message Sent!</h3>
                <p className="text-gray-400 mb-4">We'll get back to you within 24-48 hours.</p>
                <Button
                  onClick={() => setSuccess(false)}
                  className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 rounded-full"
                >
                  Send Another Message
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Your Name</label>
                  <Input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="bg-black/30 border-white/10 text-white placeholder:text-gray-600 rounded-xl"
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Email Address</label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    className="bg-black/30 border-white/10 text-white placeholder:text-gray-600 rounded-xl"
                    placeholder="john@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Subject</label>
                  <Input
                    type="text"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    required
                    className="bg-black/30 border-white/10 text-white placeholder:text-gray-600 rounded-xl"
                    placeholder="How can we help?"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Message</label>
                  <Textarea
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    required
                    rows={5}
                    className="bg-black/30 border-white/10 text-white placeholder:text-gray-600 rounded-xl resize-none"
                    placeholder="Tell us more about your inquiry..."
                  />
                </div>

                {error && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-sm">
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-black rounded-full py-3"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Send Message
                    </>
                  )}
                </Button>
              </form>
            )}
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-white/10">
          <div className="flex flex-wrap gap-4 text-sm text-gray-400">
            <Link to="/privacy-policy" className="hover:text-white transition">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-white transition">Terms & Conditions</Link>
            <Link to="/shipping-policy" className="hover:text-white transition">Shipping Policy</Link>
            <Link to="/refund-policy" className="hover:text-white transition">Refund Policy</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
