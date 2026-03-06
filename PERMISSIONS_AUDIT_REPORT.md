# Аудит системы разрешений (Permissions)

## Дата: 2025-11-13

## Текущее состояние

### ✅ Что работает корректно:

1. **База данных permissions** - содержит 56 разрешений по 20 ресурсам
2. **Связи role_permissions** - корректно настроены для всех 4 ролей:
   - `admin`: 56 разрешений (все)
   - `hr_bp`: 32 разрешения
   - `manager`: 26 разрешений
   - `employee`: 12 разрешений
3. **Функция has_permission()** - корректно работает в БД
4. **UI компонент /security** - правильно отображает разрешения и их связи с ролями

### ❌ Критические проблемы:

#### 1. RLS политики не используют систему разрешений

**Статус**: Только 2 таблицы из 40+ используют `has_permission`:
- ✅ `diagnostic_stages` - использует `diagnostics.view` и `diagnostics.manage`
- ❌ Все остальные таблицы используют устаревшие проверки

**Примеры устаревших политик:**

```sql
-- ❌ УСТАРЕВШАЯ ПОЛИТИКА
"Admins can manage career_tracks"
USING (is_current_user_admin())

-- ✅ ДОЛЖНО БЫТЬ
"Users with career.manage can manage career_tracks"
USING (has_permission(get_current_session_user(), 'career.manage'))
```

#### 2. Отсутствие пользователей с ролью HR_BP

В таблице `user_roles` нет ни одного пользователя с ролью `hr_bp`, хотя для неё определены 32 разрешения.

#### 3. Frontend не использует has_permission

**Найдено использований**: 0

Весь фронтенд полагается только на роли (`user.role === 'admin'`), а не на детальные разрешения.

## Таблицы, требующие обновления RLS политик

### Высокий приоритет (данные пользователей):

1. **users** - использовать `users.view`, `users.manage`
2. **user_profiles** - использовать `users.view`, `users.update`
3. **tasks** - использовать `tasks.view`, `tasks.manage`
4. **development_plans** - использовать `development.view`, `development.manage`
5. **one_on_one_meetings** - использовать `meetings.view`, `meetings.manage`
6. **meeting_stages** - использовать `meetings.view`, `meetings.manage`

### Средний приоритет (справочники):

7. **career_tracks** - использовать `career.view`, `career.manage`
8. **skills** - использовать `skills.view`, `skills.manage`
9. **qualities** - использовать `qualities.view`, `qualities.manage`
10. **grades** - использовать `grades.view`, `grades.manage`
11. **departments** - использовать `departments.view`, `departments.manage`

### Низкий приоритет (результаты опросов):

12. **hard_skill_results** - использовать `surveys.view`, `surveys.results`
13. **soft_skill_results** - использовать `surveys.view`, `surveys.results`
14. **survey_360_assignments** - использовать `surveys.assign`, `surveys.view`

## Рекомендуемый план миграции

### Этап 1: Обновление RLS политик (1-2 дня)

Создать миграции для обновления RLS политик в следующем порядке:

1. ✅ `diagnostic_stages` - **ЗАВЕРШЕНО**
2. `diagnostic_stage_participants`
3. `users` и `user_profiles`
4. `tasks`
5. `development_plans`
6. `meeting_stages` и `one_on_one_meetings`
7. Справочники (career_tracks, skills, qualities, grades)
8. Результаты опросов

### Этап 2: Создание недостающих пользователей

Добавить хотя бы одного тестового пользователя с ролью `hr_bp` для проверки работы системы разрешений.

### Этап 3: Обновление Frontend (опционально)

Добавить хуки для проверки разрешений:

```typescript
// hooks/usePermission.ts
export const usePermission = (permissionName: string) => {
  const { user } = useAuth();
  const [hasPermission, setHasPermission] = useState(false);
  
  useEffect(() => {
    const checkPermission = async () => {
      const { data } = await supabase.rpc('has_permission', {
        _user_id: user.id,
        _permission_name: permissionName
      });
      setHasPermission(data);
    };
    checkPermission();
  }, [user.id, permissionName]);
  
  return hasPermission;
};
```

## Шаблон обновления RLS политик

```sql
-- ПЕРЕД: устаревшая политика
DROP POLICY IF EXISTS "Old policy name" ON table_name;

-- ПОСЛЕ: использование has_permission
CREATE POLICY "Users with resource.action can perform action"
ON table_name
FOR SELECT
TO authenticated
USING (
  has_permission(get_current_session_user(), 'resource.action')
  OR /* дополнительные условия для владельца данных */
);
```

## Статус по ресурсам

| Ресурс | Разрешений | Таблицы | Статус RLS |
|--------|------------|---------|------------|
| diagnostics | 7 | diagnostic_stages | ✅ Обновлено |
| diagnostics | 7 | diagnostic_stage_participants | ❌ Требует обновления |
| users | 7 | users, user_profiles | ❌ Требует обновления |
| tasks | 6 | tasks | ❌ Требует обновления |
| meetings | 6 | meeting_stages, one_on_one_meetings | ❌ Требует обновления |
| development | 3 | development_plans | ❌ Требует обновления |
| career | 5 | career_tracks | ❌ Требует обновления |
| skills | 4 | skills, grade_skills | ❌ Требует обновления |
| qualities | 4 | qualities, grade_qualities | ❌ Требует обновления |
| grades | 4 | grades | ❌ Требует обновления |
| surveys | 6 | hard/soft_skill_results | ❌ Требует обновления |

## Заключение

Система разрешений **настроена корректно на уровне базы данных**, но **не используется в RLS политиках** большинства таблиц. Необходимо последовательно мигрировать RLS политики с устаревших проверок ролей на современную систему разрешений.

**Приоритет**: ВЫСОКИЙ
**Сложность**: СРЕДНЯЯ
**Время на исправление**: 2-3 дня для всех таблиц
