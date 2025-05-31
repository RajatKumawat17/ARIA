import React from 'react';

const WaveformVisualization = ({ 
  audioLevel = 0, 
  isActive = false, 
  barCount = 5,
  className = "" 
}) => {
  // Generate array of bars with varying heights based on audio level
  const bars = Array.from({ length: barCount }, (_, index) => {
    // Create variation in bar heights for more natural look
    const baseHeight = 20;
    const variation = Math.sin((index * Math.PI) / barCount) * 30;
    const audioMultiplier = isActive ? (audioLevel * 60 + 20) : baseHeight;
    const height = Math.max(baseHeight, audioMultiplier + variation);
    
    return {
      id: index,
      height: `${height}%`,
      delay: `${index * 0.1}s`
    };
  });

  return (
    <div className={`flex items-end justify-center space-x-1 h-16 ${className}`}>
      {bars.map((bar) => (
        <div
          key={bar.id}
          className={`waveform-bar w-2 transition-all duration-200 ${
            isActive ? 'opacity-100' : 'opacity-60'
          }`}
          style={{
            height: bar.height,
            animationDelay: bar.delay,
            animationDuration: isActive ? '0.8s' : '2s',
          }}
        />
      ))}
    </div>
  );
};

export default WaveformVisualization;