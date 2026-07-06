import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/utils/theme';
import { helpContent, HelpPageKey } from '@/utils/helpContent';

interface Props {
  pageKey: HelpPageKey;
  size?: number;
  color?: string;
}

export default function HelpButton({ pageKey, size = 22, color = colors.textMuted }: Props) {
  const [visible, setVisible] = useState(false);
  const entry = helpContent[pageKey];

  return (
    <>
      <TouchableOpacity
        onPress={() => setVisible(true)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="help-circle-outline" size={size} color={color} />
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="slide" onRequestClose={() => setVisible(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <Text style={styles.title}>{entry.title}</Text>
            <ScrollView style={{ maxHeight: '60%' }}>
              <Text style={styles.body}>{entry.body}</Text>
            </ScrollView>
            <TouchableOpacity onPress={() => setVisible(false)}>
              <Text style={styles.closeText}>Schließen</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    gap: 10,
  },
  title: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 4 },
  body: { fontSize: 15, lineHeight: 22, color: colors.textLight },
  closeText: { color: colors.textMuted, textAlign: 'center', padding: 12, fontWeight: '600' },
});
