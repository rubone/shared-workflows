import 'package:fixture/main.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('shows the greeting', (tester) async {
    await tester.pumpWidget(const MainApp());

    expect(find.text('Hello World!'), findsOneWidget);
  });
}
