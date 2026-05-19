import React from 'react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { User } from '@/types';

interface UserProfileProps {
  user: User;
  showStatus?: boolean;
  size?: 'sm' | 'md' | 'lg';
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}

const UserProfile = React.forwardRef<HTMLDivElement, UserProfileProps>(
  ({
    user,
    showStatus = true,
    size = 'md',
    orientation = 'horizontal',
    className
  }, ref) => {
    const avatarSizeClass = {
      sm: 'h-10 w-10',
      md: 'h-14 w-14',
      lg: 'h-16 w-16'
    };

    const titleClass = {
      sm: 'text-body-base font-semibold',
      md: 'text-heading-3 font-semibold',
      lg: 'text-heading-2 font-semibold'
    };

    const subtitleClass = {
      sm: 'text-caption-sm text-muted-foreground',
      md: 'text-body-md text-muted-foreground',
      lg: 'text-body-base text-muted-foreground'
    };

    const getStatusConfig = (status: string) => {
      switch (status) {
        case 'active':
          return { variant: 'success' as const, text: '👨‍💻 Активный' };
        case 'inactive':
          return { variant: 'secondary' as const, text: '⏸️ Неактивный' };
        case 'on_leave':
          return { variant: 'warning' as const, text: '🏖️ В отпуске' };
        default:
          return { variant: 'secondary' as const, text: status };
      }
    };

    const statusConfig = getStatusConfig(user.status);
    const isVertical = orientation === 'vertical';

    const getFallbackText = () => {
      if (!user.name) return '';
      return user.name
        .split(' ')
        .map(word => word[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    };

    return (
      <div
        ref={ref}
        className={cn(
          'flex gap-5',
          isVertical ? 'flex-col items-center text-center' : 'items-center',
          className
        )}
      >
        <Avatar className={cn(avatarSizeClass[size], 'shrink-0')}>
          {user.avatar && <AvatarImage src={user.avatar} alt={user.name} />}
          <AvatarFallback>{getFallbackText()}</AvatarFallback>
        </Avatar>

        <div className={cn(
          'flex-1',
          isVertical ? 'text-center' : '',
          size === 'sm' ? 'space-y-1' : 'space-y-2'
        )}>
          <h3 className={cn(titleClass[size], 'leading-none')}>
            {user.name}
          </h3>

          <div className={cn(
            'flex gap-5',
            isVertical ? 'flex-col items-center' : 'items-center flex-wrap'
          )}>
            <p className={cn(subtitleClass[size], 'leading-none')}>
              {user.position}
            </p>

            {showStatus && (
              <Badge variant={statusConfig.variant} className="opacity-80">
                {statusConfig.text}
              </Badge>
            )}
          </div>

          {size === 'lg' && user.workAddress && (
            <div className="pt-2">
              <p className="text-caption-sm text-muted-foreground">
                {user.workAddress.storeNumber} • {user.workAddress.address}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }
);

UserProfile.displayName = 'UserProfile';

export { UserProfile };