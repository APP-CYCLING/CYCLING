import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

type BrandLoaderProps = {
  message?: string;
  variant?: 'dark' | 'light';
};

export function BrandLoader({
  message = 'Cargando...',
  variant = 'dark',
}: BrandLoaderProps) {
  const isDark = variant === 'dark';

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#0F1210' : '#FFFFFF' }]}>
      <Image
        source={
          isDark
            ? require('../../04_GIFS/loading-dark.gif')
            : require('../../04_GIFS/loading-light.gif')
        }
        style={styles.gif}
        resizeMode="contain"
      />
      <Text style={[styles.text, { color: isDark ? '#FFFFFF' : '#0F1210' }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  gif: {
    width: 220,
    height: 220,
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
  },
});
