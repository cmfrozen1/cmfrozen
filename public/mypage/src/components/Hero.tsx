import { FC } from 'react';

const Hero: FC = () => {
  return (
    <div 
      className="relative z-10 flex flex-col items-center justify-center text-center px-6"
      style={{ paddingTop: 'calc(8rem - 75px)', paddingBottom: '10rem' }}
    >
      {/* Headline */}
      <h1 className="text-5xl sm:text-7xl md:text-8xl max-w-7xl font-normal font-serif text-[#000000] leading-[0.95] tracking-[-2.46px] animate-fade-rise">
        Beyond <span className="italic text-[#6F6F6F]">silence,</span> we build <br />
        <span className="italic text-[#6F6F6F]">the eternal.</span>
      </h1>

      {/* Description */}
      <p className="text-base sm:text-lg max-w-2xl mt-8 leading-relaxed text-[#6F6F6F] font-sans animate-fade-rise-delay">
        Building platforms for brilliant minds, fearless makers, and thoughtful souls. 
        Through the noise, we craft digital havens for deep work and pure flows.
      </p>

      {/* Hero CTA Button */}
      <button className="rounded-full px-14 py-5 text-base font-sans bg-[#000000] text-white mt-12 transition-transform duration-200 hover:scale-[1.03] active:scale-[0.98] animate-fade-rise-delay-2">
        Begin Journey
      </button>
    </div>
  );
};

export default Hero;
