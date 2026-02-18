import { Button } from "@/components/ui/button";
import { useNavigate, useSearchParams } from "react-router-dom";

interface CategoryFilterProps {
  categories: string[];
  activeCategory: string;
  onCategoryChange: (category: string) => void;
}

const slugifyCategory = (category: string) => {
  return category.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
};

export const CategoryFilter = ({
  categories,
  activeCategory,
  onCategoryChange,
}: CategoryFilterProps) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const handleCategoryClick = (category: string) => {
    const categorySlug = slugifyCategory(category);
    const newSearchParams = new URLSearchParams(searchParams);
    
    if (category === "All") {
      newSearchParams.delete('category');
    } else {
      newSearchParams.set('category', categorySlug);
    }
    
    // Update URL with category parameter
    const newUrl = newSearchParams.toString() ? `/?${newSearchParams.toString()}` : '/';
    navigate(newUrl, { replace: true });
    
    // Call the original handler
    onCategoryChange(category);
  };

  return (
    <div className="flex flex-wrap gap-3 justify-center mb-12">
      {categories.map((category) => (
        <Button
          key={category}
          onClick={() => handleCategoryClick(category)}
          variant={activeCategory === category ? "default" : "outline"}
          className={
            activeCategory === category
              ? "gradient-primary neon-glow font-semibold"
              : "glass hover:scale-105 transition-transform"
          }
        >
          {category}
        </Button>
      ))}
    </div>
  );
};
