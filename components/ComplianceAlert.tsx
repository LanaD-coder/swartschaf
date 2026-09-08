import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ComplianceAlert as Alert } from '@/utils/compliance';
import { colors } from '@/utils/theme';

interface Props {
  alerts: Alert[];
}

export default function ComplianceAlerts({ alerts }: Props) {
  if (alerts.length === 0) return null;

  return (
    <View style={styles.container}>
      {alerts.map((alert, i) => (
        <View
          key={i}
          style={[
            styles.alert,
            alert.level === 'critical' ? styles.critical : styles.warning,
          ]}
        >
          <Ionicons
            name={alert.level === 'critical' ? 'warning' : 'information-circle'}
            size={18}
            color={alert.level === 'critical' ? colors.danger : colors.warning}
          />
          <Text style={styles.text}>{alert.message}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8, marginBottom: 12 },
  alert: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
  },
  warning: {
    backgroundColor: '#FFEEE3',
    borderColor: colors.warning,
  },
  critical: {
    backgroundColor: '#FDE8E8',
    borderColor: colors.danger,
  },
  text: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
    lineHeight: 18,
  },
});
