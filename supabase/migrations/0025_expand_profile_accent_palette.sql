-- Expand the saved Plus profile-accent choices with common color families.
alter table public.profiles
  drop constraint if exists profiles_profile_accent_check;

alter table public.profiles
  add constraint profiles_profile_accent_check
  check (profile_accent in (
    'DEFAULT','TEAL','GREEN','LIME','CYAN','BLUE','INDIGO','VIOLET',
    'PURPLE','PINK','ROSE','RED','ORANGE','AMBER','YELLOW'
  ));
