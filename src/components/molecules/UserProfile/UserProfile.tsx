import React from 'react';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/atoms/Avatar/Avatar';
import { Text, Heading } from '@/components/atoms/Text/Text';
import { Badge } from '@/components/atoms/Badge/Badge';
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
    const avatarSize = {
      sm: 'md' as const,
      md: 'xl' as const,
      lg: '2xl' as const
    };

    const titleVariant = {
      sm: 'h6' as const,
      md: 'h3' as const,
      lg: 'h2' as const
    };

    const subtitleVariant = {
      sm: 'caption' as const,
      md: 'body-sm' as const,
      lg: 'body' as const
    };

    const statusBadgeSize = {
      sm: 'sm' as const,
      md: 'md' as const,
      lg: 'lg' as const
    };

    const getStatusConfig = (status: string) => {
      switch (status) {
        case 'active':
          return { 
            variant: 'success' as const, 
            text: '👨‍💻 Активный',
            icon: '🟢'
          };
        case 'inactive':
          return { 
            variant: 'secondary' as const, 
            text: '⏸️ Неактивный',
            icon: '⚫'
          };
        case 'on_leave':
          return { 
            variant: 'warning' as const, 
            text: '🏖️ В отпуске',
            icon: '🟡'
          };
        default:
          return { 
            variant: 'secondary' as const, 
            text: status,
            icon: '⚫'
          };
      }
    };

    const statusConfig = getStatusConfig(user.status);

    const isVertical = orientation === 'vertical';

    return (
      <div
        ref={ref}
        className={cn(
          'flex gap-5',
          isVertical ? 'flex-col items-center text-center' : 'items-center',
          className
        )}
      >
        <Avatar
          src={user.avatar}
          alt={user.name}
          size={avatarSize[size]}
          fallback={user.name}
          className="shrink-0"
        />

        <div className={cn(
          'flex-1',
          isVertical ? 'text-center' : '',
          size === 'sm' ? 'space-y-1' : 'space-y-2'
        )}>
          <div className={cn(
            'flex gap-2.5',
            isVertical ? 'flex-col items-center' : 'items-baseline flex-wrap'
          )}>
            <Heading 
              level={size === 'sm' ? 4 : size === 'md' ? 3 : 2}
              className="font-semibold leading-none"
            >
              {user.name}
            </Heading>
          </div>

          <div className={cn(
            'flex gap-5',
            isVertical ? 'flex-col items-center' : 'items-center flex-wrap'
          )}>
            <Text 
              variant={subtitleVariant[size]}
              color="secondary"
              className="leading-none"
            >
              {user.position}
            </Text>

            {showStatus && (
              <Badge
                variant={statusConfig.variant}
                size={statusBadgeSize[size]}
                className="opacity-80"
              >
                {statusConfig.text}
              </Badge>
            )}
          </div>

          {/* Additional info for larger sizes */}
          {size === 'lg' && user.workAddress && (
            <div className="pt-2">
              <Text variant="caption" color="tertiary">
                {user.workAddress.storeNumber} • {user.workAddress.address}
              </Text>
            </div>
          )}
        </div>
      </div>
    );
  }
);

UserProfile.displayName = 'UserProfile';

export { UserProfile };