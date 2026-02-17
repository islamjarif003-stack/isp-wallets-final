
'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

interface SupportChannels {
  whatsappNumber?: string;
  telegramLink?: string;
  messageTemplate?: string;
}

export default function SupportPage() {
  const { user } = useAuth();
  const [channels, setChannels] = useState<SupportChannels>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSupportChannels = async () => {
      try {
        const res = await api('/system/support-channels');
        setChannels(res.data);
      } catch (error) {
        console.error('Failed to fetch support channels', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSupportChannels();
  }, []);

  const handleWhatsAppClick = () => {
    if (!channels.whatsappNumber) return;

    let message = channels.messageTemplate || 'Hello, I need support.';
    if (user?.id) {
      message = message.replace('{{userId}}', user.id);
    }
    if (user?.mobile) {
      message = message.replace('{{mobile}}', user.mobile);
    }
    if (user?.fullName) {
      message = message.replace('{{name}}', user.fullName);
    }

    const whatsappUrl = `https://wa.me/${channels.whatsappNumber}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  };

  const handleTelegramClick = () => {
    if (!channels.telegramLink) return;
    window.open(channels.telegramLink, '_blank', 'noopener,noreferrer');
  };

  if (loading) {
    return <div className="text-center py-10">Loading Support Channels...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-center mb-8">Get Support</h1>
      <div className="max-w-md mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
        <button
          onClick={handleWhatsAppClick}
          disabled={!channels.whatsappNumber}
          className="bg-green-500 hover:bg-green-600 text-white font-bold py-4 px-6 rounded-lg shadow-lg transition-transform transform hover:scale-105 disabled:bg-gray-400 disabled:cursor-not-allowed disabled:transform-none"
        >
          <div className="flex items-center justify-center">
            {/* You would typically use an SVG icon here */}
            <span className="text-2xl mr-3"></span>
            <span>WhatsApp</span>
          </div>
        </button>

        <button
          onClick={handleTelegramClick}
          disabled={!channels.telegramLink}
          className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-4 px-6 rounded-lg shadow-lg transition-transform transform hover:scale-105 disabled:bg-gray-400 disabled:cursor-not-allowed disabled:transform-none"
        >
          <div className="flex items-center justify-center">
            {/* You would typically use an SVG icon here */}
            <span className="text-2xl mr-3"></span>
            <span>Telegram</span>
          </div>
        </button>
      </div>
      <div className="text-center mt-8 text-gray-500">
        <p>Click a channel to get in touch with our support team.</p>
      </div>
    </div>
  );
}
