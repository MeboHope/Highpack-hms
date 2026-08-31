import { Bed, Bath, Car, MapPin, Heart, Square } from 'lucide-react';
import type { Property, PropertyImage } from '@/lib/types';
import { formatKES, availabilityColor, availabilityLabel } from '@/lib/utils';
import { Badge } from '@/components/ui';

interface PropertyCardProps {
  property: Property;
  images?: PropertyImage[];
  isFavorite?: boolean;
  onFavorite?: (propertyId: string) => void;
  onClick: (propertyId: string) => void;
}

export function PropertyCard({ property, images, isFavorite, onFavorite, onClick }: PropertyCardProps) {
  const mainImage = images?.find((img) => img.category === 'main') ?? images?.[0];
  const imageUrl = mainImage?.url ?? 'https://images.pexels.com/photos/6585598/pexels-photo-6585598.jpeg?auto=compress&cs=tinysrgb&h=650&w=940';

  const price = property.listing_type === 'sale' || property.listing_type === 'both'
    ? (property.selling_price ? formatKES(property.selling_price) : null)
    : (property.monthly_rent ? `${formatKES(property.monthly_rent)}/mo` : null);

  return (
    <div
      className="group cursor-pointer overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:shadow-lg"
      onClick={() => onClick(property.id)}
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        <img
          src={imageUrl}
          alt={property.title}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />
        <div className="absolute left-3 top-3 flex gap-2">
          <Badge className={availabilityColor(property.availability_status)}>
            {availabilityLabel(property.availability_status)}
          </Badge>
          {property.is_featured && (
            <Badge className="bg-amber-100 text-amber-800 border-amber-200">Featured</Badge>
          )}
        </div>
        {onFavorite && (
          <button
            onClick={(e) => { e.stopPropagation(); onFavorite(property.id); }}
            className="absolute right-3 top-3 rounded-full bg-white/90 p-2 shadow-sm transition-colors hover:bg-white"
          >
            <Heart className={`h-4 w-4 ${isFavorite ? 'fill-red-500 text-red-500' : 'text-slate-600'}`} />
          </button>
        )}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-900/70 to-transparent p-3">
          <p className="text-lg font-bold text-white">{price}</p>
        </div>
      </div>
      <div className="p-4">
        <h3 className="line-clamp-1 font-semibold text-slate-900 group-hover:text-teal-700">{property.title}</h3>
        <p className="mt-1 flex items-center gap-1 text-sm text-slate-500">
          <MapPin className="h-3.5 w-3.5" />
          <span className="line-clamp-1">{property.estate ?? property.town ?? property.county ?? 'Kenya'}</span>
        </p>
        <div className="mt-3 flex items-center gap-4 text-sm text-slate-600">
          {property.bedrooms > 0 && (
            <span className="flex items-center gap-1"><Bed className="h-4 w-4" /> {property.bedrooms}</span>
          )}
          {property.bathrooms > 0 && (
            <span className="flex items-center gap-1"><Bath className="h-4 w-4" /> {property.bathrooms}</span>
          )}
          {property.parking_spaces > 0 && (
            <span className="flex items-center gap-1"><Car className="h-4 w-4" /> {property.parking_spaces}</span>
          )}
          {property.floor_size && (
            <span className="flex items-center gap-1"><Square className="h-4 w-4" /> {property.floor_size} sqft</span>
          )}
        </div>
      </div>
    </div>
  );
}
