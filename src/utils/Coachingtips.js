export const generateCoachingTips = (ecoScore, tripData = {}) => {
  const tips = [];

  if (ecoScore < 40) {
    tips.push({
      id: 1,
      title: 'Smooth Acceleration',
      message: 'Avoid rapid throttle increases. Gradual acceleration uses 30% less battery.',
      category: 'throttle',
      priority: 'high',
    });
    tips.push({
      id: 2,
      title: 'Braking Technique',
      message: 'Gentle braking enables regenerative energy recovery. Save energy!',
      category: 'braking',
      priority: 'high',
    });
  } else if (ecoScore < 60) {
    tips.push({
      id: 3,
      title: 'Maintain Steady Speed',
      message: 'Constant speed (40-50 km/h) is most efficient. Avoid speed spikes.',
      category: 'speed',
      priority: 'medium',
    });
    tips.push({
      id: 4,
      title: 'Plan Route Ahead',
      message: 'Reduce unnecessary turns & curves. Straight paths save energy.',
      category: 'route',
      priority: 'medium',
    });
  } else if (ecoScore < 80) {
    tips.push({
      id: 5,
      title: 'Almost There!',
      message: 'You\'re riding efficiently! Few small tweaks will get you to 90+.',
      category: 'encouragement',
      priority: 'low',
    });
  } else {
    tips.push({
      id: 6,
      title: 'Perfect Eco-Driving!',
      message: 'Excellent riding style! You\'re maximizing battery efficiency. Keep it up!',
      category: 'achievement',
      priority: 'low',
    });
  }

  // Battery-specific tips
  if (tripData.battery !== undefined && tripData.battery < 20) {
    tips.push({
      id: 7,
      title: 'Low Battery Warning',
      message: 'Battery below 20%. Head home or find charging station soon.',
      category: 'battery',
      priority: 'high',
    });
  }

  // Speed-based tips
  if (tripData.avgSpeed !== undefined && tripData.avgSpeed > 60) {
    tips.push({
      id: 8,
      title: 'Reduce Speed',
      message: 'Speeds over 60 km/h drain battery fast. Cruise at 40-50 km/h for 2h range.',
      category: 'speed',
      priority: 'high',
    });
  }

  return tips;
};

export const getTipIcon = (category) => {
  const icons = {
    throttle: '⚡',
    braking: '🛑',
    speed: '⏱️',
    route: '🗺️',
    battery: '🔋',
    encouragement: '🎯',
    achievement: '🏆',
  };
  return icons[category] || '💡';
};

export const coachingTipsPrompts = {
  aggressive: {
    title: 'Smooth Your Ride',
    tips: [
      'Avoid rapid throttle bursts',
      'Use gentle braking for regen charging',
      'Maintain 40-50 km/h for best range',
    ],
  },
  efficient: {
    title: 'You\'re Eco-Driving!',
    tips: [
      'Keep steady speed',
      'Plan efficient routes',
      'Continue smooth acceleration',
    ],
  },
  excellent: {
    title: 'Perfect Eco-Score! 🏆',
    tips: [
      'Maintain this riding style',
      'Share tips with other riders',
      'Track your battery savings',
    ],
  },
};