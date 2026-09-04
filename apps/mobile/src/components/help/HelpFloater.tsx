import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import * as Lucide from 'lucide-react-native';
import { useNavigationState } from '@react-navigation/native';

import { useTheme } from '@mobile/theme';
import { radii } from '@mobile/theme/tokens';
import { useHelpStore } from '@mobile/lib/stores/helpStore';

interface HelpFloaterProps {
  screenTopic?: string;
}

export function HelpFloater({ screenTopic }: HelpFloaterProps) {
  const { colors } = useTheme();
  const { openHelp } = useHelpStore();

  const currentRouteName = useNavigationState((state) => {
    if (!state) return undefined;
    const route = state.routes[state.index];
    return route?.name;
  });

  const handlePress = () => {
    openHelp(screenTopic || currentRouteName);
  };

  return (
    <TouchableOpacity
      style={[
        styles.btn,
        {
          backgroundColor: colors.secondary,
          borderColor: colors.border,
        },
      ]}
      onPress={handlePress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel="Open Help Menu"
    >
      <Lucide.HelpCircle size={18} color={colors.foreground} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 36,
    height: 36,
    borderRadius: radii.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});