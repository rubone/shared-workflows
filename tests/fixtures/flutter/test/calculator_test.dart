import 'package:fixture/src/calculator.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('add returns the sum', () {
    expect(add(2, 3), 5);
  });
}
