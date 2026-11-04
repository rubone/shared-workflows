using Fixture.Lib;

namespace Fixture.Lib.Tests;

public class CalculatorTests
{
    [Fact]
    public void Add_ReturnsSum() => Assert.Equal(3, Calculator.Add(1, 2));
}