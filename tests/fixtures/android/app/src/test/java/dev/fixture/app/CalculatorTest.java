package dev.fixture.app;

import static org.junit.Assert.assertEquals;

import org.junit.Test;

public class CalculatorTest {
    @Test
    public void add_returnsSum() {
        assertEquals(3, Calculator.add(1, 2));
    }
}
