import React from 'react';
import { Image } from 'react-native';

export function BrandHeaderLogo() {
  return (
    <Image
      source={require('../../01_LOGO/logo-horizontal-transparente.png')}
      style={{ width: 170, height: 42 }}
      resizeMode="contain"
    />
  );
}
