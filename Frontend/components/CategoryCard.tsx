import type React from 'react';
import type { Category } from '../types';

interface CategoryCardProps {
  category: Category;
  isSelected: boolean;
  onClick: (id: string) => void;
}

export const CategoryCard: React.FC<CategoryCardProps> = ({ category, isSelected, onClick }) => {
  const Icon = category.icon;
  
  const baseClasses = "flex flex-col items-center justify-center p-6 bg-white/5 backdrop-blur-md rounded-xl cursor-pointer transition-all duration-300 ease-in-out transform hover:-translate-y-1 hover:shadow-2xl hover:bg-white/10";
  const selectedClasses = "ring-2 ring-blue-500 bg-white/10 border-transparent shadow-2xl scale-105";
  const unselectedClasses = "border border-white/10";

  return (
    <div
      className={`${baseClasses} ${isSelected ? selectedClasses : unselectedClasses}`}
      onClick={() => onClick(category.id)}
      role="button"
      aria-pressed={isSelected}
      tabIndex={0}
    >
      <Icon className="h-10 w-10 mb-4 text-blue-400" />
      <span className="text-lg font-semibold text-gray-100 text-center">{category.name}</span>
    </div>
  );
};