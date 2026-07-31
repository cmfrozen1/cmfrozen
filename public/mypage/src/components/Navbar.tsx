import { FC } from 'react';

const Navbar: FC = () => {
  const menuItems = [
    { label: 'Home', active: true },
    { label: 'Studio', active: false },
    { label: 'About', active: false },
    { label: 'Journal', active: false },
    { label: 'Reach Us', active: false },
  ];

  return (
    <nav className="relative z-10 w-full">
      <div className="max-w-7xl mx-auto px-8 py-6 flex items-center justify-between">
        {/* Logo */}
        <div className="text-3xl tracking-tight font-serif text-[#000000] cursor-pointer">
          Aethera<sup>®</sup>
        </div>

        {/* Menu Items */}
        <div className="hidden md:flex items-center space-x-10">
          {menuItems.map((item) => (
            <a
              key={item.label}
              href="#"
              className={`text-sm font-sans transition-colors duration-200 ${
                item.active ? 'text-[#000000]' : 'text-[#6F6F6F] hover:text-[#000000]'
              }`}
            >
              {item.label}
            </a>
          ))}
        </div>

        {/* CTA Button */}
        <button className="rounded-full px-6 py-2.5 text-sm font-sans bg-[#000000] text-white transition-transform duration-200 hover:scale-[1.03] active:scale-[0.98]">
          Begin Journey
        </button>
      </div>
    </nav>
  );
};

export default Navbar;
