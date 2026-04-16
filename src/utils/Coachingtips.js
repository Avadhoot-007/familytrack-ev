// src/utils/coachingTips.js

export const generateCoachingTips = (ecoScore, tripData = {}) => {
  const tips = [];

  // Rule 1: Low eco-score
  if (ecoScore < 60) {
    tips.push({
      id: 'accel-smooth',
      title: '🌱 Smooth Acceleration',
      message: 'Rapid acceleration drains battery fast. Accelerate gently for +20% range.',
      priority: 'high',
      category: 'acceleration',
    });
  }

  // Rule 2: Speed management
  if (tripData.maxSpeed > 50 || ecoScore < 70) {
    tips.push({
      id: 'speed-cruise',
      title: '⚡ Cruise at 40 km/h',
      message: 'Optimal speed for battery efficiency. Reduces drag and energy consumption.',
      priority: tripData.maxSpeed > 55 ? 'high' : 'medium',
      category: 'speed',
    });
  }

  // Rule 3: Braking efficiency
  if (tripData.harshBrakes > 5 || ecoScore < 65) {
    tips.push({
      id: 'brake-smooth',
      title: '🛑 Smooth Braking',
      message: 'Anticipate stops. Brake gently to recover energy through regenerative braking.',
      priority: 'high',
      category: 'braking',
    });
  }

  // Rule 4: Excellent eco-score
  if (ecoScore >= 85) {
    tips.push({
      id: 'eco-champion',
      title: '🏆 Eco Champion!',
      message: 'Fantastic riding style! You\'re saving ₹500+/year on battery replacement.',
      priority: 'low',
      category: 'achievement',
    });
  }

  // Rule 5: Good eco-score with room to improve
  if (ecoScore >= 70 && ecoScore < 85) {
    tips.push({
      id: 'keep-going',
      title: '⚡ Almost Perfect!',
      message: 'Great riding! A few small tweaks and you\'ll hit 90+. Keep it up!',
      priority: 'low',
      category: 'encouragement',
    });
  }

  // Rule 6: Traffic pattern
  if (tripData.duration > 30) {
    tips.push({
      id: 'traffic-tip',
      title: '🚦 Long Ride Detected',
      message: 'Take breaks. Consistent eco-riding on long trips makes the biggest impact.',
      priority: 'medium',
      category: 'endurance',
    });
  }

  return tips;
};

export const getTipIcon = (category) => {
  const icons = {
    acceleration: '🚀',
    speed: '⚡',
    braking: '🛑',
    achievement: '🏆',
    encouragement: '💪',
    endurance: '🛣️',
  };
  return icons[category] || '💡';
};