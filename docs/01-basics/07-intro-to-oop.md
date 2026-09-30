---
title: "Lesson 7 · Introduction to OOP"
description: "Learn object-oriented programming in Python: classes, objects, __init__, instance methods, inheritance, and dunder methods."
---

# Lesson 7 · Introduction to OOP

> **Section:** 🧱 Python Basics &nbsp;|&nbsp; **Difficulty:** ⭐⭐⭐☆☆ &nbsp;|&nbsp; **Time:** ~60 minutes

---

## 🎯 Learning Objectives

- [ ] Define a class with `__init__`, instance attributes, and methods
- [ ] Understand `self` and the difference between class vs instance attributes
- [ ] Implement inheritance and method overriding
- [ ] Use `super()` to extend parent behaviour
- [ ] Implement dunder methods (`__str__`, `__repr__`, `__len__`, `__eq__`)

---

## 📖 Introduction

**Object-Oriented Programming (OOP)** organises code around *objects* — data structures that bundle state (attributes) and behaviour (methods) together. Almost all Python frameworks (Flask, Django, FastAPI) are built around OOP concepts.

---

## 1. Classes and Objects

```python
class Dog:
    # Class attribute — shared by all instances
    species = "Canis lupus familiaris"

    def __init__(self, name, breed, age):
        # Instance attributes — unique to each object
        self.name  = name
        self.breed = breed
        self.age   = age

    def bark(self):
        return f"{self.name} says: Woof!"

    def describe(self):
        return f"{self.name} is a {self.age}-year-old {self.breed}"

# Create instances
rex   = Dog("Rex",   "German Shepherd", 3)
bella = Dog("Bella", "Labrador",        5)

print(rex.bark())
print(bella.describe())
print(Dog.species)
```

Output:
```
Rex says: Woof!
Bella is a 5-year-old Labrador
Canis lupus familiaris
```

!!! info "What is `self`?"
    `self` is a reference to the current instance. It's the first parameter of every instance method, but Python passes it automatically — you never include it when you call the method.

---

## 2. Encapsulation & Properties

Use single underscore `_attr` for "private by convention" and `@property` for controlled access.

=== "Python"
    ```python
    class BankAccount:
        def __init__(self, owner, balance=0):
            self.owner = owner
            self._balance = balance   # protected by convention

        @property
        def balance(self):
            return self._balance

        @balance.setter
        def balance(self, value):
            if value < 0:
                raise ValueError("Balance cannot be negative")
            self._balance = value

        def deposit(self, amount):
            if amount <= 0:
                raise ValueError("Deposit must be positive")
            self._balance += amount
            return self._balance

        def __str__(self):
            return f"Account({self.owner}, ${self._balance:.2f})"

    acc = BankAccount("Alice", 1000)
    acc.deposit(250)
    print(acc)             # Account(Alice, $1250.00)
    print(acc.balance)     # 1250
    ```

---

## 3. Inheritance

Inheritance allows a child class to reuse and extend a parent class.

=== "Python"
    ```python
    class Animal:
        def __init__(self, name, sound):
            self.name  = name
            self.sound = sound

        def speak(self):
            return f"{self.name} says {self.sound}!"

    class Dog(Animal):
        def __init__(self, name):
            super().__init__(name, "Woof")  # call parent __init__

        def fetch(self, item):
            return f"{self.name} fetches the {item}!"

    class Cat(Animal):
        def __init__(self, name):
            super().__init__(name, "Meow")

        def purr(self):
            return f"{self.name} purrs..."

    animals = [Dog("Rex"), Cat("Whiskers"), Dog("Bella")]
    for animal in animals:
        print(animal.speak())
    print(animals[0].fetch("ball"))
    ```
=== "Output"
    ```
    Rex says Woof!
    Whiskers says Meow!
    Bella says Woof!
    Rex fetches the ball!
    ```

!!! tip "Use `isinstance()` to check types"
    ```python
    print(isinstance(animals[0], Dog))     # True
    print(isinstance(animals[0], Animal))  # True — Dog inherits Animal
    print(isinstance(animals[0], Cat))     # False
    ```

---

## 4. Dunder (Magic) Methods

Dunder methods let your objects behave like Python built-ins.

```python
class Vector:
    def __init__(self, x, y):
        self.x = x
        self.y = y

    def __repr__(self):
        return f"Vector({self.x}, {self.y})"

    def __str__(self):
        return f"({self.x}, {self.y})"

    def __add__(self, other):
        return Vector(self.x + other.x, self.y + other.y)

    def __mul__(self, scalar):
        return Vector(self.x * scalar, self.y * scalar)

    def __len__(self):
        return 2   # a 2D vector has 2 components

    def __eq__(self, other):
        return self.x == other.x and self.y == other.y

v1 = Vector(1, 2)
v2 = Vector(3, 4)

print(v1 + v2)     # (4, 6)
print(v1 * 3)      # (3, 6)
print(len(v1))     # 2
print(v1 == Vector(1, 2))  # True
print(repr(v1))    # Vector(1, 2)
```

---

## 💻 Try It Yourself

<div class="pyodide-runner" data-mode="run">
<pre><code class="language-python">class Stack:
    """A Last-In First-Out (LIFO) stack."""

    def __init__(self):
        self._items = []

    def push(self, item):
        self._items.append(item)

    def pop(self):
        if self.is_empty():
            raise IndexError("pop from empty stack")
        return self._items.pop()

    def peek(self):
        if self.is_empty():
            raise IndexError("peek at empty stack")
        return self._items[-1]

    def is_empty(self):
        return len(self._items) == 0

    def __len__(self):
        return len(self._items)

    def __repr__(self):
        return f"Stack({self._items})"

s = Stack()
s.push(10)
s.push(20)
s.push(30)
print(s)           # Stack([10, 20, 30])
print(s.peek())    # 30
print(s.pop())     # 30
print(len(s))      # 2
</code></pre>
</div>

---

## 🏋️ Challenges

### Challenge 1 — Rectangle Class

Create a `Rectangle` class with `width` and `height` attributes. Add methods `area()` and `perimeter()`. Print the area and perimeter of a 5×3 rectangle.

Expected output:
```
Area: 15
Perimeter: 16
```

<div class="pyodide-runner" data-mode="challenge" data-expected="Area: 15
Perimeter: 16">
<pre><code class="language-python">class Rectangle:
    def __init__(self, width, height):
        pass

    def area(self):
        pass

    def perimeter(self):
        pass

r = Rectangle(5, 3)
print(f"Area: {r.area()}")
print(f"Perimeter: {r.perimeter()}")
</code></pre>
</div>

---

## 📚 Further Reading

- [Classes (docs.python.org)](https://docs.python.org/3/tutorial/classes.html)
- [OOP in Python — Real Python](https://realpython.com/python3-object-oriented-programming/)
- [Dunder Methods — Real Python](https://realpython.com/operator-function-overloading/)

---

!!! success "Lesson Complete 🎉"
    OOP is how Python frameworks are built. You'll use classes in every Flask and FastAPI project ahead.

[⬅️ Lesson 6 · Exception Handling](06-exception-handling.md){ .md-button } [➡️ Lesson 8 · JSON & YAML](08-json-and-yaml.md){ .md-button .md-button--primary }
