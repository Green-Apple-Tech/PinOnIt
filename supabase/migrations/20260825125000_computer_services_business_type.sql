-- Add computer / IT services as an onboarding business type.

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_business_type_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_business_type_check
  CHECK (
    business_type IS NULL OR business_type IN (
      'landscaper',
      'plumber',
      'hvac',
      'electrician',
      'handyman',
      'carpenter',
      'pressure_washer',
      'car_washer',
      'painter',
      'roofer',
      'locksmith',
      'pest_control',
      'appliance_repair',
      'garage_door',
      'carpet_cleaning',
      'junk_removal',
      'pool_service',
      'window_cleaner',
      'house_cleaning',
      'moving',
      'auto_shop',
      'computer_services',
      'dentist',
      'salon',
      'spa',
      'fitness',
      'pet_care',
      'tutoring',
      'photography',
      'therapy',
      'real_estate',
      'legal',
      'accounting',
      'insurance',
      'mortgage',
      'notary',
      'mobile_trade',
      'personal_services',
      'professional_services',
      'other'
    )
  );
