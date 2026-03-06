// Утилита для работы с пользовательскими данными
// Шифрование удалено - данные хранятся в открытом виде

export interface UserData {
  id?: string;
  first_name: string;
  last_name: string;
  middle_name?: string;
  email: string;
}

export interface DecryptedUserData {
  id?: string;
  first_name: string;
  last_name: string;
  middle_name: string;
  email: string;
}

/**
 * Возвращает данные пользователя без изменений (шифрование удалено)
 * Функция оставлена для обратной совместимости
 */
export async function decryptUserData(userData: UserData): Promise<DecryptedUserData> {
  return {
    id: userData.id,
    first_name: userData.first_name || '',
    last_name: userData.last_name || '',
    middle_name: userData.middle_name || '',
    email: userData.email || '',
  };
}

/**
 * Форматирует полное имя пользователя
 */
export function getFullName(user: Partial<DecryptedUserData> | null | undefined): string {
  if (!user) return 'Сотрудник';
  
  const parts = [
    user.last_name,
    user.first_name,
    user.middle_name,
  ].filter(Boolean);
  
  return parts.length > 0 ? parts.join(' ') : 'Сотрудник';
}
